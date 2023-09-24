import type { Config } from "./config.js";
import { DataProcessor } from "./data-processor.js";
import type { Source } from "./source.js";

export interface PluginSetupContext {
	/** The global configuration. */
	readonly config: Config;
}

export interface PluginContext {
	/** The global configuration. */
	readonly config: Config;
	/** The global data processor. */
	readonly dataProcessor: DataProcessor;
}

export interface Plugin {
	/**
	 * Called to initialize the plugin.
	 *
	 * @param context The plugin context.
	 * @param config The plugin configuration.
	 */
	setup?(context: PluginSetupContext, config: unknown): void | Promise<void>;

	/**
	 * Called to try to create s source for the specified file.
	 *
	 * @param filename The absolute filename.
	 * @param content The content of the file.
	 * @param context The plugin context.
	 *
	 * @returns A source instance or undefined if this plugin can not handle the specified file type.
	 */
	createSource?(filename: string, content: Buffer, context: PluginContext): Source | undefined | void;
}

export interface PluginModule {
	default: (new () => Plugin) | Plugin;
}
