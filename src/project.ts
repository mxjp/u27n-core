import { Config } from "./config.js";
import { DataProcessor } from "./data-processor.js";
import { Diagnostic } from "./index.js";
import { Manifest } from "./manifest.js";
import { Plugin, PluginContext, PluginModule, PluginSetupContext } from "./plugin.js";
import { Source } from "./source.js";
import { TranslationData } from "./translation-data.js";
import { FileSystem } from "./utility/file-system.js";

export class Project {
	readonly config: Config;
	readonly fileSystem: FileSystem;
	readonly dataProcessor: DataProcessor;

	readonly #plugins: Plugin[] = [];
	readonly #pluginContext: PluginContext;

	private constructor(
		options: Project.Options,
		dataProcessor: DataProcessor,
		plugins: Plugin[],
	) {
		this.config = options.config;
		this.fileSystem = options.fileSystem;
		this.dataProcessor = dataProcessor;
		this.#plugins = plugins;
		this.#pluginContext = {
			config: options.config,
			dataProcessor,
		};
	}

	watch(options: Project.WatchOptions): () => Promise<void> {
		return this.fileSystem.watchFiles({
			cwd: this.config.context,
			patterns: [
				this.config.translationData.filename,
				...this.config.include,
			],
			delay: options.delay,
			onError: options.onError,
			onChange: async changes => {
				let diagnostics: Diagnostic[] = [];
				const updatedSources = new Map<string, Source>();
				const removedSources = new Set<string>();
				let translationData: TranslationData | undefined = undefined;

				for (const filename of changes.updated) {
					if (filename === this.config.translationData.filename) {
						const translationDataJson = await this.fileSystem.readOptionalFile(this.config.translationData.filename);
						if (translationDataJson !== undefined) {
							translationData = TranslationData.parseJson(translationDataJson.toString("utf-8"));
						}
					} else {
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
				}

				for (const filename of changes.removed) {
					if (filename !== this.config.translationData.filename) {
						removedSources.add(Source.filenameToSourceId(this.config.context, filename));
					}
				}

				const result = this.dataProcessor.applyUpdate({
					updatedSources,
					removedSources,
					translationData,
					modify: options.modify,
					discardObsolete: this.config.obsolete.discard,
				});

				if (options.modify) {
					if (this.dataProcessor.translationDataModified) {
						this.dataProcessor.translationDataModified = false;
						await this.fileSystem.writeFile(this.config.translationData.filename, Buffer.from(TranslationData.formatJson(this.dataProcessor.translationData, this.config.translationData.sorted), "utf-8"));
					}
					for (const [sourceId, content] of result.modifiedSources) {
						await this.fileSystem.writeFile(Source.sourceIdToFilename(this.config.context, sourceId), Buffer.from(content, "utf-8"));
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

				await options.onDiagnostics?.(diagnostics);
				await options.onFinish?.({
					diagnostics,
					translationDataChanged: translationData !== undefined,
				});
			},
		});
	}

	async run(options: Project.RunOptions): Promise<Project.RunResult> {
		let diagnostics: Diagnostic[] = [];
		const translationDataJson = await this.fileSystem.readOptionalFile(this.config.translationData.filename);
		const translationData = translationDataJson === undefined ? undefined : TranslationData.parseJson(translationDataJson.toString("utf-8"));

		const sources = new Map<string, Source>();
		for (const filename of await this.fileSystem.findFiles({
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
			translationData,
			updatedSources: sources,
			modify: true,
			discardObsolete: this.config.obsolete.discard,
		});

		if (options.modify) {
			if (this.dataProcessor.translationDataModified) {
				this.dataProcessor.translationDataModified = false;
				await this.fileSystem.writeFile(this.config.translationData.filename, Buffer.from(TranslationData.formatJson(this.dataProcessor.translationData, this.config.translationData.sorted), "utf-8"));
			}
			for (const [sourceId, content] of result.modifiedSources) {
				await this.fileSystem.writeFile(Source.sourceIdToFilename(this.config.context, sourceId), Buffer.from(content, "utf-8"));
			}
		} else if (this.dataProcessor.translationDataModified || result.modifiedSources.size > 0) {
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
				await this.fileSystem.writeFile(filename, Buffer.from(JSON.stringify(localeData), "utf-8"));
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
			await this.fileSystem.writeFile(manifestFilename, Buffer.from(Manifest.stringify(manifest), "utf-8"));
		}
	}

	async #createSource(filename: string): Promise<Source | undefined> {
		const content = await this.fileSystem.readFile(filename);
		for (const plugin of this.#plugins) {
			const source = plugin.createSource?.(filename, content, this.#pluginContext);
			if (source) {
				return source;
			}
		}
	}

	static async create(options: Project.Options): Promise<Project> {
		const plugins: Plugin[] = [];
		const pluginSetupContext: PluginSetupContext = {
			config: options.config,
		};

		for (const pluginConfig of options.config.plugins) {
			const module = await import(pluginConfig.entry) as PluginModule;
			const plugin = typeof module.default === "function" ? new module.default() : module.default;
			await plugin.setup?.(pluginSetupContext, pluginConfig.config);
			plugins.push(plugin);
		}

		const dataProcessor = new DataProcessor(pluginSetupContext);

		return new Project(options, dataProcessor, plugins);
	}
}

export declare namespace Project {
	export interface Options {
		config: Config;
		fileSystem: FileSystem;
	}

	export interface WatchOptions {
		delay: number;
		output: boolean;
		modify: boolean;
		fragmentDiagnostics: boolean;
		/** @deprecated Use {@link onFinish} instead. */
		onDiagnostics?: (diagnostics: Diagnostic[]) => void | Promise<void>;
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
		translationDataChanged: boolean;
	}
}
