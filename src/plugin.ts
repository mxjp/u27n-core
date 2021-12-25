import type { Config } from "./config.js";
import { Project } from "./project.js";
import type { Source } from "./source.js";

export interface SetupPluginContext extends Project.Options {
	/** The global configuration. */
	readonly config: Config;
}

export interface PluginContext {
	/** The global configuration. */
	readonly config: Config;
	/** The global project. */
	readonly project: Project;
}

export interface Plugin {
	/**
	 * Called to initialize the plugin.
	 *
	 * @param context The plugin context.
	 * @param config The plugin configuration.
	 */
	setup?(context: SetupPluginContext, config: unknown): void | Promise<void>;

	/**
	 * Called to try to create s source for the specified file.
	 *
	 * @param filename The absolute filename.
	 * @param content The content of the file.
	 * @param context The plugin context.
	 *
	 * @returns A source instance or undefined if this plugin can not handle the specified file type.
	 */
	createSource?(filename: string, content: string, context: PluginContext): Source | undefined | void;
}

export interface PluginModule {
	default: (new () => Plugin) | Plugin;
}
