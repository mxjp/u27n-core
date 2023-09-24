import type { Config } from "./config.js";
import { DataAdapter } from "./data-adapter.js";
import type { Source } from "./source.js";

export interface Plugin {
	/**
	 * Called to initialize the plugin.
	 *
	 * @param context The plugin context.
	 * @param config The plugin configuration.
	 */
	setup?(context: Plugin.Context, config: unknown): void | Promise<void>;

	/**
	 * Called to try to create s source for the specified file.
	 *
	 * @param filename The absolute filename.
	 * @param pluginContext The plugin context.
	 *
	 * @returns A source instance or undefined if this plugin can not handle the specified file type.
	 */
	createSource?(context: Plugin.CreateSourceContext): Source | undefined | void | Promise<Source | undefined | void>;
}

export declare namespace Plugin {
	export interface Context {
		/** The global configuration. */
		readonly config: Config;

		/**
		 * Set the data adapter for the curren project.
		 *
		 * This can be called once per project. Any consecutive call will throw an error.
		 */
		setDataAdapter(dataAdapter: DataAdapter): void;
	}

	export interface Module {
		default: (new () => Plugin) | Plugin;
	}

	export interface CreateSourceContext {
		/**
		 * The filename of the source.
		 */
		get filename(): string;

		/**
		 * Read and cache the file content.
		 */
		getContent: () => Promise<Buffer>;

		/**
		 * Read and cache the file content as UTF-8 encoded text.
		 */
		getTextContent: () => Promise<string>;
	}
}
