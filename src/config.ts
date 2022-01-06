import { readFile } from "fs/promises";
import { dirname, normalize, resolve } from "path";
import resolveModule from "resolve";

import { DiagnosticSeverityConfig, DiagnosticType, diagnosticTypes } from "./diagnostics.js";
import { DiscardObsoleteFragmentType, discardObsoleteFragmentTypes } from "./obsolete-handling.js";

export interface Config {
	readonly context: string;
	readonly translationData: Config.TranslationData;
	readonly namespace: string;
	readonly include: string[];
	readonly sourceLocale: string;
	readonly translatedLocales: string[];
	readonly plugins: Config.Plugin[];
	readonly obsolete: Config.Obsolete;
	readonly output: Config.Output;
	readonly diagnostics: DiagnosticSeverityConfig;
}

export namespace Config {
	export interface Json {
		translationData?: TranslationDataJson;
		namespace?: string;
		include?: string[];
		locales?: string[];
		plugins?: (string | PluginJson)[];
		obsolete?: ObsoleteJson;
		output?: OutputJson;
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

	export interface Obsolete {
		discard: DiscardObsoleteFragmentType;
	}

	export interface ObsoleteJson {
		discard?: DiscardObsoleteFragmentType;
	}

	export interface TranslationData {
		filename: string;
		sorted: boolean;
	}

	export interface TranslationDataJson {
		filename?: string;
		sorted?: boolean;
	}

	export interface OutputJson {
		filename?: string | null;
		includeOutdated?: boolean;
	}

	export interface Output {
		filename: string | null;
		includeOutdated: boolean;
	}

	export function getOutputFilename(filenameTemplate: string, locale: string): string {
		return filenameTemplate.replace(/\[locale\]/g, locale);
	}

	export async function read(filename: string): Promise<Config> {
		return fromJson(JSON.parse(await readFile(filename, "utf-8")) as Json, dirname(filename));
	}

	export async function fromJson(json: Json, context: string): Promise<Config> {
		const translationDataFilename = resolve(context, json.translationData?.filename ?? "./u27n-data.json");
		const translationDataSorted = json.translationData?.sorted ?? true;
		if (typeof translationDataSorted !== "boolean") {
			throw new TypeError("translationData.sorted must be a boolean.");
		}

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

		const obsoleteDiscard = json.obsolete?.discard ?? DiscardObsoleteFragmentType.Outdated;
		if (!discardObsoleteFragmentTypes.has(obsoleteDiscard)) {
			throw new TypeError(`obsolete.discard must be one of ${JSON.stringify(Array.from(discardObsoleteFragmentTypes))}.`);
		}

		const rawOutputFilename = json.output?.filename ?? "./dist/locale/[locale].json";
		if (rawOutputFilename !== null && typeof rawOutputFilename !== "string") {
			throw new TypeError("output.filename must be a string.");
		}
		const outputFilename = rawOutputFilename ? resolve(context, rawOutputFilename) : null;

		const outputIncludeOutdated = json.output?.includeOutdated ?? false;
		if (typeof outputIncludeOutdated !== "boolean") {
			throw new TypeError("output.includeOutdated must be a boolean.");
		}

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
			translationData: {
				filename: translationDataFilename,
				sorted: translationDataSorted,
			},
			namespace,
			include,
			sourceLocale: locales[0],
			translatedLocales: locales.slice(1),
			plugins,
			obsolete: {
				discard: obsoleteDiscard,
			},
			output: {
				filename: outputFilename,
				includeOutdated: outputIncludeOutdated,
			},
			diagnostics,
		};
	}
}
