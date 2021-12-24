import type { Config } from "./config.js";
import { Project } from "./project.js";
import type { Source } from "./source.js";

export interface PluginContext extends Project.Options {
	/**
	 * The global configuration.
	 */
	readonly config: Config;
}

export interface Plugin {
	/**
	 * Called to initialize the plugin.
	 *
	 * @param context The plugin context.
	 * @param config The plugin configuration.
	 */
	setup(context: PluginContext, config: unknown): void | Promise<void>;

	/**
	 * Called to try to create s source for the specified file.
	 *
	 * @param filename The absolute filename.
	 * @param content The content of the file.
	 *
	 * @returns A source instance or undefined if this plugin can not handle the specified file type.
	 */
	createSource?(filename: string, content: string): Source | undefined | void;
}

export interface PluginModule {
	default: (new () => Plugin) | Plugin;
}
