import { Position } from "@mpt/line-map";

import { Diagnostic } from "./diagnostics.js";
import { Base62FragmentIdGenerator, FragmentIdGenerator } from "./fragment-id-generator.js";
import { Manifest } from "./manifest.js";
import { DiscardObsoleteFragmentType } from "./obsolete-handling.js";
import { getPluralInfo } from "./plural-info.js";
import { LocaleData } from "./runtime/locale-data.js";
import type { Source } from "./source.js";
import { TranslationData } from "./translation-data.js";
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

	/**
	 * Map from fragment ids to locales to translations.
	 */
	readonly #pendingTranslationChanges = new Map<string, Map<string, TranslationData.Translation>>();

	constructor(options: DataProcessor.Options = {}) {
		this.#fragmentIdGenerator = options.fragmentIdGenerator ?? new Base62FragmentIdGenerator();
	}

	/**
	 * True if there are any pending changes.
	 */
	get hasPendingChanges(): boolean {
		return this.#pendingTranslationChanges.size > 0;
	}

	/**
	 * Get the current translation data that is managed by this project.
	 */
	get translationData(): TranslationData {
		return this.#translationDataView.data;
	}

	/**
	 * Get or set if the translation data that is managed by this project has been modified by applying an update.
	 */
	get translationDataModified(): boolean {
		return this.#translationDataView.modified;
	}

	set translationDataModified(value: boolean) {
		this.#translationDataView.modified = value;
	}

	/**
	 * Get a source instance for the specified source id.
	 */
	getSource(sourceId: string): Source | undefined {
		return this.#sources.get(sourceId);
	}

	/**
	 * Set a translation.
	 *
	 * Note, that the translation data object is not changed in place, but a pending change is created.
	 *
	 * @see {applyPendingChanges}
	 */
	setTranslation(fragmentId: string, locale: string, value: TranslationData.Value, modified?: Date): void {
		const translation: TranslationData.Translation = {
			modified: TranslationDataView.createTimestamp(modified),
			value,
		};

		const translations = this.#pendingTranslationChanges.get(fragmentId);
		if (translations === undefined) {
			this.#pendingTranslationChanges.set(fragmentId, new Map([
				[locale, translation],
			]));
		} else {
			translations.set(locale, translation);
		}
	}

	/**
	 * Discard all pending changes.
	 */
	discardPendingChanges(): void {
		this.#pendingTranslationChanges.clear();
	}

	/**
	 * Apply translation changes to a copy of the current translation data object.
	 */
	applyPendingChanges(): TranslationData {
		const data = TranslationData.clone(this.#translationDataView.data);
		this.#pendingTranslationChanges.forEach((locales, fragmentId) => {
			const fragment = data.fragments[fragmentId];
			if (fragment !== undefined) {
				locales.forEach((translation, locale) => {
					fragment.translations[locale] = translation;
				});
			}
		});
		return data;
	}

	/**
	 * Export all pending changes in this data processor as a json serializable object.
	 */
	exportPendingChanges(): DataProcessor.PendingChanges {
		const changes: DataProcessor.PendingChanges = {
			translations: {},
		};
		this.#pendingTranslationChanges.forEach((map, fragmentId) => {
			const translations: Record<string, TranslationData.Translation> = {};
			map.forEach((translation, locale) => {
				translations[locale] = translation;
			});
			changes.translations[fragmentId] = translations;
		});
		return changes;
	}

	/**
	 * Import pending changes.
	 *
	 * Changes that are already in place will not be overwritten.
	 */
	importPendingChanges(changes: DataProcessor.PendingChanges): void {
		for (const fragmentId in changes.translations) {
			const translations = changes.translations[fragmentId];
			const map = this.#pendingTranslationChanges.get(fragmentId);
			if (map === undefined) {
				this.#pendingTranslationChanges.set(fragmentId, new Map(Object.entries(translations)));
			} else {
				for (const locale in translations) {
					if (!map.has(locale)) {
						map.set(locale, translations[locale]);
					}
				}
			}
		}
	}

	/**
	 * Get an array of all fragments for a specific source that are in sync.
	 *
	 * @returns The array of editable fragments or undefined if the source does not exist.
	 */
	getEditableFragments(sourceId: string): DataProcessor.EditableFragment[] | undefined {
		const source = this.#sources.get(sourceId);
		if (source !== undefined) {
			const editableFragments: DataProcessor.EditableFragment[] = [];
			const fragments = source.fragments;
			for (let i = 0; i < fragments.length; i++) {
				const sourceFragment = fragments[i];
				const dataFragment = this.#translationDataView.getSyncFragment(sourceId, sourceFragment);
				if (dataFragment !== null) {
					const translations: Record<string, TranslationData.Translation> = {
						...dataFragment.translations,
					};

					const editedLocales: string[] = [];
					this.#pendingTranslationChanges.get(sourceFragment.fragmentId!)?.forEach((translation, locale) => {
						translations[locale] = translation;
						editedLocales.push(locale);
					});

					editableFragments.push({
						sourceId,
						fragmentId: sourceFragment.fragmentId!,
						enabled: sourceFragment.enabled,
						translations,
						value: dataFragment.value,
						modified: dataFragment.modified,
						start: sourceFragment.start,
						startPos: source.lineMap.getPosition(sourceFragment.start),
						end: sourceFragment.end,
						endPos: source.lineMap.getPosition(sourceFragment.end),
						editedLocales,
					});
				}
			}
			return editableFragments;
		}
	}

	/**
	 * Apply updates from disk to the project.
	 */
	applyUpdate(update: DataProcessor.Update): DataProcessor.UpdateResult {
		const modify = update.modify ?? true;
		const modifiedSources = new Map<string, string>();

		const discardObsolete = update.discardObsolete ?? DiscardObsoleteFragmentType.All;

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
				this.#translationDataView.removeFragmentsOfSource(sourceId, discardObsolete, fragmentId => {
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
				this.#translationDataView.removeFragmentsOfSource(sourceId, discardObsolete, fragmentId => {
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
			}, discardObsolete);
		}

		return { modifiedSources };
	}

	getFragmentDiagnostics(options: DataProcessor.DiagnosticOptions): Diagnostic[] {
		const diagnostics: Diagnostic[] = [];
		const allLocales = new Set<string>(options.translatedLocales);
		allLocales.add(options.sourceLocale);

		const sourcePluralInfo = getPluralInfo(options.sourceLocale);

		this.#translationDataView.forEachSyncFragment(sourceId => {
			return this.#sources.get(sourceId);
		}, (fragmentId, fragment) => {
			const fragmentModified = TranslationDataView.parseTimestamp(fragment.modified);

			const missingLocales = new Set(options.translatedLocales);
			const unknownLocales: string[] = [];
			const outdatedLocales: string[] = [];
			const typeMismatchLocales: string[] = [];

			if (sourcePluralInfo !== undefined && TranslationDataView.isPluralValue(fragment.value)) {
				const actualFormCount = fragment.value.value.length;
				if (actualFormCount !== sourcePluralInfo.formCount) {
					diagnostics.push({
						type: "pluralFormCountMismatch",
						sourceId: fragment.sourceId,
						fragmentId,
						locale: options.sourceLocale,
						actualFormCount,
						expectedFormCount: sourcePluralInfo.formCount,
					});
				}
			}

			for (const locale in fragment.translations) {
				allLocales.add(locale);

				const translation = fragment.translations[locale];
				if (!missingLocales.delete(locale)) {
					unknownLocales.push(locale);
				}
				if (TranslationDataView.isOutdated(fragmentModified, translation)) {
					outdatedLocales.push(locale);
				}
				if (!TranslationDataView.valueTypeEquals(fragment.value, translation.value)) {
					typeMismatchLocales.push(locale);
				}

				if (TranslationDataView.isPluralValue(translation.value)) {
					const pluralInfo = getPluralInfo(locale);
					const actualFormCount = translation.value.value.length;
					if (pluralInfo !== undefined && actualFormCount !== pluralInfo.formCount) {
						diagnostics.push({
							type: "pluralFormCountMismatch",
							sourceId: fragment.sourceId,
							fragmentId,
							locale,
							actualFormCount,
							expectedFormCount: pluralInfo.formCount,
						});
					}
				}
			}

			if (missingLocales.size > 0) {
				diagnostics.push({
					type: "missingTranslations",
					sourceId: fragment.sourceId,
					fragmentId,
					locales: Array.from(missingLocales).sort(),
				});
			}
			if (unknownLocales.length > 0) {
				diagnostics.push({
					type: "unknownTranslations",
					sourceId: fragment.sourceId,
					fragmentId,
					locales: unknownLocales.sort(),
				});
			}
			if (outdatedLocales.length > 0) {
				diagnostics.push({
					type: "outdatedTranslations",
					sourceId: fragment.sourceId,
					fragmentId,
					locales: outdatedLocales.sort(),
				});
			}
			if (typeMismatchLocales.length > 0) {
				diagnostics.push({
					type: "valueTypeMismatch",
					sourceId: fragment.sourceId,
					fragmentId,
					locales: typeMismatchLocales.sort(),
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

		const unsupportedLocales = Array.from(allLocales).filter(locale => getPluralInfo(locale) === undefined);
		if (unsupportedLocales.length > 0) {
			diagnostics.push({
				type: "unsupportedLocales",
				locales: unsupportedLocales.sort(),
			});
		}

		return diagnostics;
	}

	generateLocaleData(options: DataProcessor.GenerateLocateDataOptions): Map<string, LocaleData> {
		const data = new Map<string, LocaleData>();

		const { translatedLocales } = options;
		data.set(options.sourceLocale, Object.create(null) as {});
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

		this.#sources.forEach((source, sourceId) => {
			source.fragments.forEach(fragment => {
				if (fragment.enabled) {
					const fragmentData = this.#translationDataView.getSyncFragment(sourceId, fragment);
					// eslint-disable-next-line @typescript-eslint/prefer-optional-chain
					if (fragmentData !== null && fragmentData.value !== null) {
						const fragmentModified = TranslationDataView.parseTimestamp(fragmentData.modified);
						for (let i = 0; i < translatedLocales.length; i++) {
							const locale = translatedLocales[i];
							const translation = fragmentData.translations[locale];
							if (translation !== undefined
								&& TranslationDataView.valueTypeEquals(fragmentData.value, translation.value)
								&& (options.includeOutdated || !TranslationDataView.isOutdated(fragmentModified, translation))) {
								addValue(locale, options.namespace, fragment.fragmentId!, TranslationData.toRawValue(translation.value));
							}
						}
					}
				}
			});
		});

		return data;
	}

	generateManifest(options: DataProcessor.GenerateManifestOptions): Manifest {
		const manifest: Manifest = {
			version: 1,
			locales: {},
			files: {},
		};

		options.localeDataFilenames.forEach((filename, locale) => {
			manifest.locales[locale] = Manifest.filenameToFileId(options.manifestFilename, filename);
		});

		const files = new Map<string, {
			fragmentIds: Set<string>;
		}>();

		this.#sources.forEach(source => {
			const filenames = source.getOutputFilenames?.();

			const fileIds = (filenames === undefined || filenames.length === 0)
				? [Manifest.GLOBAL_FILE_ID]
				: filenames.map(filename => Manifest.filenameToFileId(options.manifestFilename!, filename));

			for (const fileId of fileIds) {
				let info = files.get(fileId);
				if (info === undefined) {
					info = {
						fragmentIds: new Set(),
					};
					files.set(fileId, info);
				}
				source.fragments.forEach(fragment => {
					if (fragment.fragmentId !== undefined) {
						info!.fragmentIds.add(fragment.fragmentId);
					}
				});
			}
		});

		files.forEach((info, fileId) => {
			manifest.files[fileId] = {
				namespace: options.namespace,
				fragmentIds: Array.from(info.fragmentIds),
			};
		});

		return manifest;
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
		/** Map of source ids to new sources or sources that have been updated on disk */
		updatedSources?: Map<string, Source>;
		/** Set of source ids that have been removed from disk */
		removedSources?: Set<string>;
		/** The initial or updated translation data from disk */
		translationData?: TranslationData;
		/** True to allow modifying sources */
		modify?: boolean;
		/** How to handle discarding obsolete fragments */
		discardObsolete?: DiscardObsoleteFragmentType;
	}

	export interface UpdateResult {
		/** Map of source ids to modified content to write to disk */
		modifiedSources: Map<string, string>;
	}

	export interface DiagnosticOptions {
		sourceLocale: string;
		translatedLocales: string[];
	}

	export interface GenerateLocateDataOptions {
		namespace: string;
		sourceLocale: string;
		translatedLocales: string[];
		includeOutdated: boolean;
	}

	export interface EditableFragment extends TranslationData.Fragment {
		fragmentId: string;
		start: number;
		startPos: Position | null;
		end: number;
		endPos: Position | null;
		editedLocales: string[];
	}

	export interface PendingChanges {
		translations: Record<string, Record<string, TranslationData.Translation>>;
	}

	export interface GenerateManifestOptions {
		/** The project namespace. */
		namespace: string;
		/** The absolute manifest filename. */
		manifestFilename: string;
		/** Map of locale codes to absolute output locale data filenames. */
		localeDataFilenames: Map<string, string>;
	}
}
