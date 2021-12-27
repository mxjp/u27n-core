import { Diagnostic } from "./diagnostics.js";
import { Base62FragmentIdGenerator, FragmentIdGenerator } from "./fragment-id-generator.js";
import { LocaleData } from "./locale-data.js";
import type { Source } from "./source.js";
import type { TranslationData } from "./translation-data.js";
import { SourceFragmentMap } from "./utility/source-fragment-map.js";
import { TranslationDataView } from "./utility/translation-data-view.js";

export class DataProcessor {
	/**
	 * The default fragment id generator that is used if
	 * the source does not provide it's own generator.
	 */
	readonly #fragmentIdGenerator: FragmentIdGenerator;

	/**
	 * The current translation data view that is used.
	 *
	 * This is only modified while updates are processed.
	 */
	#translationDataView = new TranslationDataView();

	/**
	 * Map of current source ids to source instances.
	 */
	readonly #sources = new Map<string, Source>();

	/**
	 * Map of source ids to fragment ids.
	 */
	readonly #sourceFragments = new SourceFragmentMap();

	public constructor(options: DataProcessor.Options = {}) {
		this.#fragmentIdGenerator = options.fragmentIdGenerator ?? new Base62FragmentIdGenerator();
	}

	/**
	 * Get the current translation data that is managed by this project.
	 */
	public get translationData(): TranslationData {
		return this.#translationDataView.data;
	}

	/**
	 * Get or set if the translation data that is managed by this project has been modified by applying an update.
	 */
	public get translationDataModified(): boolean {
		return this.#translationDataView.modified;
	}

	public set translationDataModified(value: boolean) {
		this.#translationDataView.modified = value;
	}

	/**
	 * Get a source instance for the specified source id.
	 */
	public getSource(sourceId: string): Source | undefined {
		return this.#sources.get(sourceId);
	}

	/**
	 * Apply updates from disk to the project.
	 */
	public applyUpdate(update: DataProcessor.Update): DataProcessor.UpdateResult {
		const modify = update.modify ?? true;
		const modifiedSources = new Map<string, string>();

		function updateSource(this: DataProcessor, source: Source, sourceId: string) {
			if (source.update) {
				const updateResult = source.update({
					updateId: fragment => {
						if (
							fragment.fragmentId !== undefined
							&& !assignedFragmentIds.has(fragment.fragmentId)
							&& (
								!this.#sourceFragments.hasOtherSources(sourceId, fragment.fragmentId)
								|| this.#translationDataView.getSyncFragment(sourceId, fragment) !== null
							)
						) {
							assignedFragmentIds.add(fragment.fragmentId);
							return fragment.fragmentId;
						}

						const generator = source.fragmentIdGenerator ?? this.#fragmentIdGenerator;

						let id: string;
						do {
							id = generator.generate(this.#sourceFragments.fragmentToSources);
						} while (assignedFragmentIds.has(id) || this.#sourceFragments.hasFragment(id));
						assignedFragmentIds.add(id);
						return id;
					},
				});

				if (updateResult.modified) {
					modifiedSources.set(sourceId, updateResult.content);
				}

				updateResult.fragments.forEach((update, fragmentId) => {
					this.#translationDataView.updateFragment(sourceId, fragmentId, update);
				});
				this.#translationDataView.removeFragmentsOfSource(sourceId, fragmentId => {
					return !updateResult.fragments.has(fragmentId);
				});
			} else {
				const staticFragments = source.fragmentMap;
				staticFragments.forEach((fragment, fragmentId) => {
					if (fragment.value !== null && !assignedFragmentIds.has(fragmentId) && !this.#sourceFragments.hasOtherSources(sourceId, fragmentId)) {
						assignedFragmentIds.add(fragmentId);
						this.#translationDataView.updateFragment(sourceId, fragmentId, {
							enabled: fragment.enabled,
							value: fragment.value,
							oldFragmentId: undefined,
						});
					}
				});
				this.#translationDataView.removeFragmentsOfSource(sourceId, fragmentId => {
					return !staticFragments.has(fragmentId);
				});
			}
		}

		update.updatedSources?.forEach((source, sourceId) => {
			this.#sourceFragments.updateSource(sourceId, source.fragmentMap);
		});
		update.removedSources?.forEach(sourceId => {
			this.#sourceFragments.removeSource(sourceId);
		});

		const assignedFragmentIds = new Set<string>();
		if (update.translationData) {
			this.#translationDataView = new TranslationDataView(update.translationData);
		}

		update.updatedSources?.forEach((source, sourceId) => {
			this.#sources.set(sourceId, source);
			if (modify) {
				updateSource.call(this, source, sourceId);
			}
		});

		if (update.translationData) {
			this.#sources.forEach((source, sourceId) => {
				if (update.removedSources?.has(sourceId)) {
					this.#sources.delete(sourceId);
				} else if (!update.updatedSources?.has(sourceId) && modify) {
					updateSource.call(this, source, sourceId);
				}
			});
		} else {
			update.removedSources?.forEach(sourceId => {
				this.#sources.delete(sourceId);
			});
		}

		if (modify) {
			this.#translationDataView.removeSources(sourceId => {
				return !this.#sources.has(sourceId);
			});
		}

		return { modifiedSources };
	}

	public getFragmentDiagnostics(options: DataProcessor.DiagnosticOptions): Diagnostic[] {
		const diagnostics: Diagnostic[] = [];

		this.#translationDataView.forEachFragment((fragmentId, fragment) => {
			const sourceModified = Date.parse(fragment.modified);

			const missingLocales = new Set(options.translatedLocales);
			const unknownLocales: string[] = [];
			const outdatedLocales: string[] = [];
			for (const locale in fragment.translations) {
				if (!missingLocales.delete(locale)) {
					unknownLocales.push(locale);
				}
				if (Date.parse(fragment.translations[locale].modified) < sourceModified) {
					outdatedLocales.push(locale);
				}
			}
			if (missingLocales.size > 0) {
				diagnostics.push({
					type: "missingTranslations",
					sourceId: fragment.sourceId,
					fragmentId,
					locales: Array.from(missingLocales),
				});
			}
			if (unknownLocales.length > 0) {
				diagnostics.push({
					type: "unknownTranslations",
					sourceId: fragment.sourceId,
					fragmentId,
					locales: unknownLocales,
				});
			}
			if (outdatedLocales.length > 0) {
				diagnostics.push({
					type: "outdatedTranslations",
					sourceId: fragment.sourceId,
					fragmentId,
					locales: outdatedLocales,
				});
			}
		});

		this.#sourceFragments.fragmentToSources.forEach((sourceIds, fragmentId) => {
			if (sourceIds.size > 1) {
				diagnostics.push({
					type: "duplicateFragment",
					sourceIds: Array.from(sourceIds),
					fragmentId,
				});
			}
		});

		return diagnostics;
	}

	public generateLocaleData(options: DataProcessor.GenerateLocateDataOptions): Map<string, LocaleData> {
		const data = new Map<string, LocaleData>();

		const { translatedLocales } = options;
		for (let i = 0; i < translatedLocales.length; i++) {
			data.set(translatedLocales[i], Object.create(null) as {});
		}

		function addValue(locale: string, namespace: string, fragmentId: string, value: LocaleData.Value): void {
			const namespaces = data.get(locale)!;
			let fragments = namespaces[namespace];
			if (fragments === undefined) {
				fragments = namespaces[namespace] = Object.create(null) as {};
			}
			fragments[fragmentId] = value;
		}

		function toValue(translationDataValue: TranslationData.Value): LocaleData.Value {
			if (typeof translationDataValue === "string") {
				return translationDataValue;
			} else if (translationDataValue !== null) {
				switch (translationDataValue.type) {
					case "plural": return translationDataValue.value;
				}
			}
			throw new Error("invalid value");
		}

		this.#sources.forEach((source, sourceId) => {
			source.fragments.forEach(fragment => {
				const fragmentData = this.#translationDataView.getSyncFragment(sourceId, fragment);
				// eslint-disable-next-line @typescript-eslint/prefer-optional-chain
				if (fragmentData !== null && fragmentData.value !== null) {
					const modified = Date.parse(fragmentData.modified);
					for (let i = 0; i < translatedLocales.length; i++) {
						const locale = translatedLocales[i];
						const translation = fragmentData.translations[locale];
						if (translation !== undefined
							&& TranslationDataView.valueTypeEquals(fragmentData.value, translation.value)
							&& (options.includeOutdated || Date.parse(translation.modified) >= modified)) {
							addValue(locale, options.namespace, fragment.fragmentId!, toValue(translation.value));
						}
					}
				}
			});
		});

		return data;
	}
}

export declare namespace DataProcessor {
	export interface Options {
		/**
		 * The fragment id generator to use.
		 *
		 * By default, a new `Base62FragmentIdGenerator` instance is used.
		 */
		fragmentIdGenerator?: FragmentIdGenerator;
	}

	export interface Update {
		/** Map of source ids to new sources or sources that have been changed on disk */
		updatedSources?: Map<string, Source>;
		/** Set of source ids that have been removed from disk */
		removedSources?: Set<string>;
		/** The initial or updated translation data from disk */
		translationData?: TranslationData;
		/** True to allow modifying sources */
		modify?: boolean;
	}

	export interface UpdateResult {
		/** Map of source ids to modified content to write to disk */
		modifiedSources: Map<string, string>;
	}

	export interface DiagnosticOptions {
		translatedLocales: string[];
	}

	export interface GenerateLocateDataOptions {
		namespace: string;
		translatedLocales: string[];
		includeOutdated: boolean;
	}
}
