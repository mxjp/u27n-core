import { readFile } from "node:fs/promises";

import { Config } from "./config.js";
import { DataAdapter } from "./data-adapter.js";
import { DataProcessor } from "./data-processor.js";
import { FileChanges, findFiles, watchFiles, writeFile } from "./file-system.js";
import { Diagnostic } from "./index.js";
import { Manifest } from "./manifest.js";
import { Plugin } from "./plugin.js";
import { Source } from "./source.js";
import { filenameToSourceId, sourceIdToFilename } from "./source-id.js";
import { taskQueue } from "./utility/task-queue.js";

export class Project {
	readonly config: Config;
	readonly dataProcessor: DataProcessor;

	readonly #createSourcePlugins: Plugin[] = [];

	private constructor(
		options: Project.Options,
		dataProcessor: DataProcessor,
		plugins: Plugin[],
	) {
		this.config = options.config;
		this.dataProcessor = dataProcessor;
		this.#createSourcePlugins = plugins.filter(plugin => plugin.createSource);
	}

	watch(options: Project.WatchOptions): () => Promise<void> {
		const applyUpdate = taskQueue(async (sourceChanges: FileChanges) => {
			const dataReloaded = await this.dataProcessor.dataAdapter.reload();

			let diagnostics: Diagnostic[] = [];
			const updatedSources = new Map<string, Source>();
			const removedSources = new Set<string>();
			for (const filename of sourceChanges.updated) {
				const source = await this.#createSource(filename);
				const sourceId = filenameToSourceId(this.config.context, filename);
				if (source === undefined) {
					diagnostics.push({
						type: "unsupportedSource",
						sourceId,
					});
				} else {
					updatedSources.set(sourceId, source);
				}
			}

			for (const filename of sourceChanges.removed) {
				removedSources.add(filenameToSourceId(this.config.context, filename));
			}

			const result = this.dataProcessor.applyUpdate({
				updatedSources,
				removedSources,
				modify: options.modify,
				discardObsolete: this.config.obsolete.discard,
			});

			if (options.modify) {
				await this.dataProcessor.dataAdapter.persist();
				for (const [sourceId, update] of result.modifiedSources) {
					const filename = sourceIdToFilename(this.config.context, sourceId);
					await persistUpdate(filename, update);
				}
			}

			if (options.fragmentDiagnostics) {
				diagnostics = diagnostics.concat(this.dataProcessor.getFragmentDiagnostics({
					sourceLocale: this.config.sourceLocale,
					translatedLocales: this.config.translatedLocales,
				}));
			}

			if (options.output) {
				await this.#generateOutput();
			}

			await options.onFinish?.({
				diagnostics,
				dataReloaded,
			});
		});

		const closeSourceWatcher = watchFiles({
			cwd: this.config.context,
			patterns: this.config.include,
			delay: options.delay,
			onError: options.onError,
			onChange: applyUpdate,
		});

		let closeDataWatcher: (() => Promise<void>) | undefined = undefined;
		if (this.dataProcessor.dataAdapter.watchPatterns) {
			closeDataWatcher = watchFiles({
				cwd: this.dataProcessor.dataAdapter.watchPatternCwd ?? this.config.context,
				patterns: this.dataProcessor.dataAdapter.watchPatterns,
				delay: options.delay,
				onError: options.onError,
				onChange: () => applyUpdate({
					updated: [],
					removed: [],
				}),
			});
		}

		return async () => {
			await closeSourceWatcher();
			await closeDataWatcher?.();
		};
	}

	async run(options: Project.RunOptions): Promise<Project.RunResult> {
		let diagnostics: Diagnostic[] = [];

		const dataReloaded = await this.dataProcessor.dataAdapter.reload();

		const sources = new Map<string, Source>();
		for (const filename of await findFiles({
			cwd: this.config.context,
			patterns: this.config.include,
		})) {
			const source = await this.#createSource(filename);
			const sourceId = filenameToSourceId(this.config.context, filename);
			if (source === undefined) {
				diagnostics.push({
					type: "unsupportedSource",
					sourceId,
				});
			} else {
				sources.set(sourceId, source);
			}
		}

		const result = this.dataProcessor.applyUpdate({
			updatedSources: sources,
			modify: true,
			discardObsolete: this.config.obsolete.discard,
		});

		if (options.modify) {
			await this.dataProcessor.dataAdapter.persist();
			for (const [sourceId, update] of result.modifiedSources) {
				const filename = sourceIdToFilename(this.config.context, sourceId);
				await persistUpdate(filename, update);
			}
		} else if (this.dataProcessor.dataAdapter.modified || result.modifiedSources.size > 0) {
			diagnostics.push({
				type: "projectOutOfSync",
			});
		}

		if (options.fragmentDiagnostics) {
			diagnostics = diagnostics.concat(this.dataProcessor.getFragmentDiagnostics({
				sourceLocale: this.config.sourceLocale,
				translatedLocales: this.config.translatedLocales,
			}));
		}

		if (options.output) {
			await this.#generateOutput();
		}

		return {
			diagnostics,
			dataReloaded,
		};
	}

	async #generateOutput(): Promise<void> {
		const localeDataFilenames = new Map<string, string>();
		if (this.config.output.filename) {
			const data = this.dataProcessor.generateLocaleData({
				namespace: this.config.namespace,
				sourceLocale: this.config.sourceLocale,
				translatedLocales: this.config.translatedLocales,
				includeOutdated: this.config.output.includeOutdated,
			});

			for (const [locale, localeData] of data) {
				const filename = Config.getOutputFilename(this.config.output.filename, locale);
				await writeFile(filename, Buffer.from(JSON.stringify(localeData), "utf-8"));
				localeDataFilenames.set(locale, filename);
			}
		}

		const manifestFilename = this.config.output.manifestFilename;
		if (manifestFilename) {
			const manifest = this.dataProcessor.generateManifest({
				namespace: this.config.namespace,
				manifestFilename,
				localeDataFilenames,
			});
			await writeFile(manifestFilename, Buffer.from(Manifest.stringify(manifest), "utf-8"));
		}
	}

	async #createSource(filename: string): Promise<Source | undefined> {
		let content: Promise<Buffer> | undefined = undefined;
		let textContent: Promise<string> | undefined = undefined;

		async function getContent(): Promise<Buffer> {
			if (content === undefined) {
				content = readFile(filename);
			}
			return content;
		}

		async function getTextContent(): Promise<string> {
			if (textContent === undefined) {
				textContent = getContent().then(content => content.toString("utf-8"));
			}
			return textContent;
		}

		const context: Plugin.CreateSourceContext = {
			filename,
			getContent,
			getTextContent,
		};
		for (const plugin of this.#createSourcePlugins) {
			const source = await plugin.createSource?.(context);
			if (source) {
				return source;
			}
		}
	}

	static async create(options: Project.Options): Promise<Project> {
		const plugins: Plugin[] = [];

		let setupDone = false;
		let customDataAdapter: DataAdapter | undefined = undefined;
		const context: Plugin.Context = {
			config: options.config,

			setDataAdapter(dataAdapter) {
				if (setupDone) {
					throw new Error("data adapter can only be set while setting up plugins.");
				}
				if (customDataAdapter !== undefined) {
					throw new Error("only one custom data adapter can be set.");
				}
				customDataAdapter = dataAdapter;
			},
		};

		for (const pluginConfig of options.config.plugins) {
			const module = await import(pluginConfig.entry) as Plugin.Module;
			const plugin = typeof module.default === "function" ? new module.default() : module.default;
			await plugin.setup?.(context, pluginConfig.config);
			plugins.push(plugin);
		}

		setupDone = true;

		let dataAdapter: DataAdapter | undefined = customDataAdapter;
		if (dataAdapter === undefined) {
			const module = await import("./default-data-adapter/adapter.js");
			dataAdapter = new module.DefaultDataAdapter(options.config.data);
		}

		const dataProcessor = new DataProcessor({
			dataAdapter,
		});

		return new Project(options, dataProcessor, plugins);
	}
}

async function persistUpdate(filename: string, update: Source.UpdateResult): Promise<void> {
	if (update.persist !== undefined) {
		await update.persist();
	} else if (update.content !== undefined) {
		await writeFile(filename, update.content);
	} else if (update.textContent !== undefined) {
		await writeFile(filename, Buffer.from(update.textContent, "utf-8"));
	}
}

export declare namespace Project {
	export interface Options {
		config: Config;
	}

	export interface WatchOptions {
		delay: number;
		output: boolean;
		modify: boolean;
		fragmentDiagnostics: boolean;
		onFinish?: (result: WatchRunResult) => void | Promise<void>;
		onError?: (error: unknown) => void;
	}

	export interface RunOptions {
		output: boolean;
		modify: boolean;
		fragmentDiagnostics: boolean;
	}

	export interface RunResult {
		diagnostics: Diagnostic[];
		dataReloaded: boolean;
	}

	export interface WatchRunResult extends RunResult {
	}
}
