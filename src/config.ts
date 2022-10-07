import { readFile } from "fs/promises";
import { dirname, normalize, resolve } from "path";
import resolveModule from "resolve";

import { DiagnosticSeverityConfig, DiagnosticType, diagnosticTypes } from "./diagnostics.js";
import { Manifest } from "./manifest.js";
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
		manifestPath?: string | null;
	}

	export interface Output {
		filename: string | null;
		includeOutdated: boolean;
		manifestFilename: string | null;
	}

	export interface Defaults {
		translationDataFilename: string;
		translationDataSorted: boolean;
		namespace: string;
		include: string[];
		locales: string[];
		obsoleteDiscard: DiscardObsoleteFragmentType;
		outputFilename: string;
		outputIncludeOutdated: boolean;
		outputManifestPath: string;
		diagnostics: DiagnosticSeverityConfig;
	}

	export const DEFAULTS: Defaults = {
		translationDataFilename: "./u27n-data.json",
		translationDataSorted: true,
		namespace: "",
		include: ["./src/**/*"],
		locales: ["en"],
		obsoleteDiscard: DiscardObsoleteFragmentType.All,
		outputFilename: "./dist/locale/[locale].json",
		outputIncludeOutdated: false,
		outputManifestPath: "./dist",
		diagnostics: {},
	};

	export function getOutputFilename(filenameTemplate: string, locale: string): string {
		return filenameTemplate.replace(/\[locale\]/g, locale);
	}

	export async function read(filename: string, defaults?: Partial<Defaults>): Promise<Config> {
		return fromJson(JSON.parse(await readFile(filename, "utf-8")) as Json, dirname(filename), defaults);
	}

	function clone<T>(value: T) {
		return JSON.parse(JSON.stringify(value)) as T;
	}

	export async function fromJson(json: Json, context: string, defaults?: Partial<Defaults>): Promise<Config> {
		const allDefaults = {
			...DEFAULTS,
			...defaults,
		};

		const translationDataFilename = resolve(context, json.translationData?.filename ?? allDefaults.translationDataFilename);
		const translationDataSorted = json.translationData?.sorted ?? allDefaults.translationDataSorted;
		if (typeof translationDataSorted !== "boolean") {
			throw new TypeError("translationData.sorted must be a boolean.");
		}

		const namespace = json.namespace ?? allDefaults.namespace;
		if (typeof namespace !== "string") {
			throw new TypeError("namespace must be a string.");
		}

		const include = json.include ?? clone(allDefaults.include);
		if (!Array.isArray(include) || include.some(s => typeof s !== "string")) {
			throw new TypeError("include must be an array of strings.");
		}

		const locales = json.locales ?? clone(allDefaults.locales);
		if (!Array.isArray(locales) || locales.some(s => typeof s !== "string")) {
			throw new TypeError("locales must be an array of strings.");
		}
		if (locales.length === 0) {
			throw new TypeError("locales must include at least the source locale.");
		}

		const plugins: Plugin[] = [];
		if (json.plugins) {
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
					config = pluginJson.config ?? {};
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
		}

		const obsoleteDiscard = json.obsolete?.discard ?? allDefaults.obsoleteDiscard;
		if (!discardObsoleteFragmentTypes.has(obsoleteDiscard)) {
			throw new TypeError(`obsolete.discard must be one of ${JSON.stringify(Array.from(discardObsoleteFragmentTypes))}.`);
		}

		const rawOutputFilename = json.output?.filename ?? allDefaults.outputFilename;
		if (rawOutputFilename !== null && typeof rawOutputFilename !== "string") {
			throw new TypeError("output.filename must be a string.");
		}
		const outputFilename = rawOutputFilename ? resolve(context, rawOutputFilename) : null;

		const rawOutputManifestPath = json.output?.manifestPath ?? allDefaults.outputManifestPath;
		if (rawOutputManifestPath !== null && typeof rawOutputManifestPath !== "string") {
			throw new TypeError("output.manifestFilename must be a string.");
		}
		const outputManifestFilename = rawOutputManifestPath ? resolve(context, rawOutputManifestPath, Manifest.NAME) : null;

		const outputIncludeOutdated = json.output?.includeOutdated ?? allDefaults.outputIncludeOutdated;
		if (typeof outputIncludeOutdated !== "boolean") {
			throw new TypeError("output.includeOutdated must be a boolean.");
		}

		const diagnostics = json.diagnostics ?? clone(allDefaults.diagnostics);
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
				manifestFilename: outputManifestFilename,
			},
			diagnostics,
		};
	}
}
