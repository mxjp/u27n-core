import { readFile } from "fs/promises";
import { dirname, resolve } from "path";

export interface Config {
	readonly context: string;
	readonly translationData: string;
	readonly namespace: string;
	readonly include: string[];
	readonly locales: string[];
	readonly plugins: Config.Plugin[];
	readonly output: string | null;
}

export namespace Config {
	export interface Json {
		translationData?: string;
		namespace?: string;
		include?: string[];
		locales?: string[];
		plugins?: (string | PluginJson)[];
		output?: string;
	}

	export interface PluginJson {
		entry: string;
		config?: unknown;
	}

	export interface Plugin {
		readonly entry: string;
		readonly config: unknown;
	}

	export async function read(filename: string): Promise<Config> {
		return fromJson(JSON.parse(await readFile(filename, "utf-8")) as Json, dirname(filename));
	}

	export function fromJson(json: Json, context: string): Config {
		const translationData = resolve(context, json.translationData ?? "./u27n-data.json");

		const namespace = json.namespace ?? "";
		if (typeof namespace !== "string") {
			throw new TypeError("namespace must be a string.");
		}

		const include = json.include ?? ["./src/**"];
		if (!Array.isArray(include) || include.some(s => typeof s !== "string")) {
			throw new TypeError("include must be an array of strings.");
		}

		const locales = json.locales ?? ["en"];
		if (!Array.isArray(locales) || locales.some(s => typeof s !== "string")) {
			throw new TypeError("locales must be an array of strings.");
		}
		if (locales.length === 0) {
			throw new TypeError("locales must include at least the source locale.");
		}

		const plugins: Plugin[] = [];
		if (!Array.isArray(json.plugins)) {
			throw new TypeError("plugins must be an array.");
		}
		for (let i = 0; i < plugins.length; i++) {
			const pluginJson = plugins[i];
			// TODO: Resolve plugin module path.
			if (typeof pluginJson === "string") {
				plugins.push({
					entry: pluginJson,
					config: {},
				});
			} else if (typeof pluginJson === "object" && pluginJson !== null && !Array.isArray(pluginJson)) {
				const entry = pluginJson.entry;
				if (typeof entry !== "string") {
					throw new TypeError(`plugins[${i}].entry must be a string`);
				}
				plugins.push({
					entry,
					config: pluginJson.config ?? {},
				});
			} else {
				throw new TypeError(`plugins[${i}] must be a string or an object.`);
			}
		}

		const output = json.output ? resolve(context, json.output ?? "./dist/locale/[locale].json") : null;

		return {
			context,
			translationData,
			namespace,
			include,
			locales,
			plugins,
			output,
		};
	}
}
