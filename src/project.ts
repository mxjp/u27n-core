import { readFile } from "node:fs/promises";

import { Config } from "./config.js";
import { DataAdapter } from "./data-adapter.js";
import { DefaultDataAdapter } from "./data-adapter-default.js";
import { DataProcessor } from "./data-processor.js";
import { findFiles, watchFiles, writeFile } from "./file-system.js";
import { Diagnostic } from "./index.js";
import { Manifest } from "./manifest.js";
import { Plugin, PluginContext, PluginModule, PluginSetupContext } from "./plugin.js";
import { Source } from "./source.js";

export class Project {
	readonly config: Config;
	readonly dataProcessor: DataProcessor;

	readonly #plugins: Plugin[] = [];
	readonly #pluginContext: PluginContext;

	private constructor(
		options: Project.Options,
		dataProcessor: DataProcessor,
		plugins: Plugin[],
	) {
		this.config = options.config;
		this.dataProcessor = dataProcessor;
		this.#plugins = plugins;
		this.#pluginContext = {
			config: options.config,
			dataProcessor,
		};
	}

	watch(options: Project.WatchOptions): () => Promise<void> {
		return watchFiles({
			cwd: this.config.context,
			patterns: this.config.include,
			delay: options.delay,
			onError: options.onError,
			onChange: async changes => {
				await this.dataProcessor.dataAdapter.reload();

				let diagnostics: Diagnostic[] = [];
				const updatedSources = new Map<string, Source>();
				const removedSources = new Set<string>();
				for (const filename of changes.updated) {
					const source = await this.#createSource(filename);
					const sourceId = Source.filenameToSourceId(this.config.context, filename);
					if (source === undefined) {
						diagnostics.push({
							type: "unsupportedSource",
							sourceId,
						});
					} else {
						updatedSources.set(sourceId, source);
					}
				}

				for (const filename of changes.removed) {
					removedSources.add(Source.filenameToSourceId(this.config.context, filename));
				}

				const result = this.dataProcessor.applyUpdate({
					updatedSources,
					removedSources,
					modify: options.modify,
					discardObsolete: this.config.obsolete.discard,
				});

				if (options.modify) {
					await this.dataProcessor.dataAdapter.persist();
					for (const [sourceId, content] of result.modifiedSources) {
						await writeFile(Source.sourceIdToFilename(this.config.context, sourceId), Buffer.from(content, "utf-8"));
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
				});
			},
		});
	}

	async run(options: Project.RunOptions): Promise<Project.RunResult> {
		console.log("Running project.");

		let diagnostics: Diagnostic[] = [];

		await this.dataProcessor.dataAdapter.reload();

		const sources = new Map<string, Source>();
		for (const filename of await findFiles({
			cwd: this.config.context,
			patterns: this.config.include,
		})) {
			const source = await this.#createSource(filename);
			const sourceId = Source.filenameToSourceId(this.config.context, filename);
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
			for (const [sourceId, content] of result.modifiedSources) {
				await writeFile(Source.sourceIdToFilename(this.config.context, sourceId), Buffer.from(content, "utf-8"));
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

		return { diagnostics };
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
		const content = await readFile(filename);
		for (const plugin of this.#plugins) {
			const source = plugin.createSource?.(filename, content, this.#pluginContext);
			if (source) {
				return source;
			}
		}
	}

	static async create(options: Project.Options): Promise<Project> {
		const plugins: Plugin[] = [];

		let customDataAdapter: DataAdapter | undefined = undefined;
		const pluginSetupContext: PluginSetupContext = {
			config: options.config,

			setDataAdapter(dataAdapter) {
				if (dataAdapter !== undefined) {
					throw new Error("only one custom data adapter can be set.");
				}
				customDataAdapter = dataAdapter;
			},
		};

		for (const pluginConfig of options.config.plugins) {
			const module = await import(pluginConfig.entry) as PluginModule;
			const plugin = typeof module.default === "function" ? new module.default() : module.default;
			await plugin.setup?.(pluginSetupContext, pluginConfig.config);
			plugins.push(plugin);
		}

		const dataProcessor = new DataProcessor({
			dataAdapter: customDataAdapter ?? new DefaultDataAdapter(options.config.data),
		});

		return new Project(options, dataProcessor, plugins);
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
	}

	export interface WatchRunResult extends RunResult {
	}
}
