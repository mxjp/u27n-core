import { readFile } from "fs/promises";
import { dirname, normalize, resolve } from "path";
import resolveModule from "resolve";

import { DiagnosticSeverityConfig, DiagnosticType, diagnosticTypes } from "./diagnostics.js";

export interface Config {
	readonly context: string;
	readonly translationData: string;
	readonly namespace: string;
	readonly include: string[];
	readonly locales: string[];
	readonly plugins: Config.Plugin[];
	readonly output: string | null;
	readonly diagnostics: DiagnosticSeverityConfig;
}

export namespace Config {
	export interface Json {
		translationData?: string;
		namespace?: string;
		include?: string[];
		locales?: string[];
		plugins?: (string | PluginJson)[];
		output?: string;
		diagnostics?: DiagnosticSeverityConfig;
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

	export async function fromJson(json: Json, context: string): Promise<Config> {
		const translationData = resolve(context, json.translationData ?? "./u27n-data.json");

		const namespace = json.namespace ?? "";
		if (typeof namespace !== "string") {
			throw new TypeError("namespace must be a string.");
		}

		const include = json.include ?? ["./src/**/*"];
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
		for (let i = 0; i < json.plugins.length; i++) {
			let entry: string;
			let config: unknown;

			const pluginJson = json.plugins[i];
			if (typeof pluginJson === "string") {
				entry = pluginJson;
				config = {};
			} else if (typeof pluginJson === "object" && pluginJson !== null && !Array.isArray(pluginJson)) {
				entry = pluginJson.entry;
				if (typeof entry !== "string") {
					throw new TypeError(`plugins[${i}].entry must be a string`);
				}
			} else {
				throw new TypeError(`plugins[${i}] must be a string or an object.`);
			}
			// eslint-disable-next-line require-atomic-updates
			entry = await new Promise<string>((resolve, reject) => {
				resolveModule(entry, {
					basedir: context,
					includeCoreModules: false,
				}, (error, entry) => {
					if (error) {
						reject(error);
					} else {
						resolve(normalize(entry!));
					}
				});
			});
			plugins.push({ entry, config });
		}

		const output = json.output ? resolve(context, json.output ?? "./dist/locale/[locale].json") : null;

		const diagnostics = json.diagnostics ?? {};
		if (typeof diagnostics !== "object" || diagnostics === null || Array.isArray(diagnostics)) {
			throw new TypeError(`diagnostics must be an object.`);
		}
		for (const type in diagnostics) {
			if (type !== "*" && !diagnosticTypes.has(type as DiagnosticType)) {
				throw new TypeError(`unknown diagnostic type: ${JSON.stringify(type)}`);
			}
		}

		return {
			context,
			translationData,
			namespace,
			include,
			locales,
			plugins,
			output,
			diagnostics,
		};
	}
}
