import { Config } from "./config.js";
import { DataProcessor } from "./data-processor.js";
import { Diagnostic } from "./index.js";
import { Plugin, PluginContext, PluginModule, PluginSetupContext } from "./plugin.js";
import { Source } from "./source.js";
import { TranslationData } from "./translation-data.js";
import { FileSystem } from "./utility/file-system.js";

export class Project {
	public readonly config: Config;
	public readonly fileSystem: FileSystem;
	public readonly dataProcessor: DataProcessor;

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

	public watch(options: Project.WatchOptions): () => Promise<void> {
		return this.fileSystem.watchFiles({
			cwd: this.config.context,
			patterns: [
				this.config.translationData,
				...this.config.include,
			],
			onError: options.onError,
			onChange: async changes => {
				const diagnostics: Diagnostic[] = [];
				const updatedSources = new Map<string, Source>();
				const removedSources = new Set<string>();
				let translationData: TranslationData | undefined = undefined;

				for (const filename of changes.updated) {
					if (filename === this.config.translationData) {
						const translationDataJson = await this.fileSystem.readOptionalFile(this.config.translationData);
						if (translationDataJson !== undefined) {
							translationData = TranslationData.parseJson(translationDataJson);
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
					if (filename !== this.config.translationData) {
						removedSources.add(Source.filenameToSourceId(this.config.context, filename));
					}
				}

				const result = this.dataProcessor.applyUpdate({
					updatedSources,
					removedSources,
					translationData,
				});

				if (options.modify) {
					if (this.dataProcessor.translationDataModified) {
						this.dataProcessor.translationDataModified = false;
						await this.fileSystem.writeFile(this.config.translationData, TranslationData.formatJson(this.dataProcessor.translationData));
					}
					for (const [sourceId, content] of result.modifiedSources) {
						await this.fileSystem.writeFile(Source.sourceIdToFilename(this.config.context, sourceId), content);
					}
				}

				if (options.output) {
					// TODO: Write output.
				}

				options.onDiagnostics?.(diagnostics);
			},
		});
	}

	public async run(options: Project.RunOptions): Promise<Project.RunResult> {
		const diagnostics: Diagnostic[] = [];
		const translationDataJson = await this.fileSystem.readOptionalFile(this.config.translationData);
		const translationData = translationDataJson === undefined ? undefined : TranslationData.parseJson(translationDataJson);

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
		});

		if (options.modify) {
			if (this.dataProcessor.translationDataModified) {
				this.dataProcessor.translationDataModified = false;
				await this.fileSystem.writeFile(this.config.translationData, TranslationData.formatJson(this.dataProcessor.translationData));
			}
			for (const [sourceId, content] of result.modifiedSources) {
				await this.fileSystem.writeFile(Source.sourceIdToFilename(this.config.context, sourceId), content);
			}
		} else if (this.dataProcessor.translationDataModified || result.modifiedSources.size > 0) {
			diagnostics.push({
				type: "projectOutOfSync",
			});
		}

		if (options.output) {
			// TODO: Write output.
		}

		return { diagnostics };
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

	public static async create(options: Project.Options): Promise<Project> {
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
		output: boolean;
		modify: boolean;
		onDiagnostics?: (diagnostics: Diagnostic[]) => void;
		onError?: (error: unknown) => void;
	}

	export interface RunOptions {
		output: boolean;
		modify: boolean;
	}

	export interface RunResult {
		diagnostics: Diagnostic[];
	}
}
