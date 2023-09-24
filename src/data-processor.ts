import { DataAdapter } from "./data-adapter.js";
import { Diagnostic } from "./diagnostics.js";
import { Base62FragmentIdGenerator, FragmentIdGenerator } from "./fragment-id-generator.js";
import { Manifest } from "./manifest.js";
import { DiscardObsoleteFragmentType } from "./obsolete-handling.js";
import { getPluralInfo } from "./plural-info.js";
import { LocaleData } from "./runtime/locale-data.js";
import type { Source } from "./source.js";
import { SourceFragmentMap } from "./utility/source-fragment-map.js";

export class DataProcessor {
	#dataRevision: number;

	/**
	 * The current data adapter.
	 */
	readonly #dataAdapter: DataAdapter;

	/**
	 * The default fragment id generator that is used if
	 * the source does not provide it's own generator.
	 */
	readonly #fragmentIdGenerator: FragmentIdGenerator;

	/**
	 * Map of current source ids to source instances.
	 */
	readonly #sources = new Map<string, Source>();

	/**
	 * Map of source ids to fragment ids.
	 */
	readonly #sourceFragments = new SourceFragmentMap();

	constructor(options: DataProcessor.Options) {
		this.#dataRevision = options.dataAdapter.revision;
		this.#dataAdapter = options.dataAdapter;
		this.#fragmentIdGenerator = options.fragmentIdGenerator ?? new Base62FragmentIdGenerator();
	}

	get dataAdapter(): DataAdapter {
		return this.#dataAdapter;
	}

	/**
	 * Get a source instance for the specified source id.
	 */
	getSource(sourceId: string): Source | undefined {
		return this.#sources.get(sourceId);
	}

	/**
	 * Apply updates from disk to the project.
	 */
	applyUpdate(update: DataProcessor.Update): DataProcessor.UpdateResult {
		const modify = update.modify ?? true;
		const modifiedSources = new Map<string, Source.UpdateResult>();

		const discardObsoleteType = update.discardObsolete ?? "all";

		function updateSource(this: DataProcessor, source: Source, sourceId: string): void {
			if (source.update) {
				const updateResult = source.update({
					updateId: fragment => {
						if (
							fragment.fragmentId !== undefined
							&& !assignedFragmentIds.has(fragment.fragmentId)
							&& (
								!this.#sourceFragments.hasOtherSources(sourceId, fragment.fragmentId)
								|| this.#dataAdapter.getSyncFragment(sourceId, fragment) !== undefined
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
					modifiedSources.set(sourceId, updateResult);
				}

				updateResult.fragments.forEach((update, fragmentId) => {
					this.#dataAdapter.updateFragment(sourceId, fragmentId, update);
				});
				this.#dataAdapter.discardFragments(sourceId, discardObsoleteType, new IdSet(updateResult.fragments));
			} else {
				const staticFragments = source.fragmentMap;
				staticFragments.forEach((fragment, fragmentId) => {
					if (fragment.value !== null && !assignedFragmentIds.has(fragmentId) && !this.#sourceFragments.hasOtherSources(sourceId, fragmentId)) {
						assignedFragmentIds.add(fragmentId);
						this.#dataAdapter.updateFragment(sourceId, fragmentId, {
							enabled: fragment.enabled,
							value: fragment.value,
							oldFragmentId: undefined,
						});
					}
				});
				this.#dataAdapter.discardFragments(sourceId, discardObsoleteType, new IdSet(staticFragments));
			}
		}

		update.updatedSources?.forEach((source, sourceId) => {
			this.#sourceFragments.updateSource(sourceId, source.fragmentMap);
		});
		update.removedSources?.forEach(sourceId => {
			this.#sourceFragments.removeSource(sourceId);
		});

		const assignedFragmentIds = new Set<string>();

		update.updatedSources?.forEach((source, sourceId) => {
			this.#sources.set(sourceId, source);
			if (modify) {
				updateSource.call(this, source, sourceId);
			}
		});

		if (this.#dataRevision !== this.#dataAdapter.revision) {
			this.#dataRevision = this.#dataAdapter.revision;
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
			this.#dataAdapter.discardSources(discardObsoleteType, new IdSet(this.#sources));
		}

		return { modifiedSources };
	}

	getFragmentDiagnostics(options: DataProcessor.DiagnosticOptions): Diagnostic[] {
		const diagnostics: Diagnostic[] = [];
		const allLocales = new Set<string>(options.translatedLocales);
		allLocales.add(options.sourceLocale);

		const sourcePluralInfo = getPluralInfo(options.sourceLocale);

		this.#dataAdapter.forEachSyncFragment(sourceId => {
			return this.#sources.get(sourceId);
		}, (fragmentId, fragment) => {
			const missingLocales = new Set(options.translatedLocales);
			const unknownLocales: string[] = [];
			const outdatedLocales: string[] = [];
			const typeMismatchLocales: string[] = [];

			if (sourcePluralInfo !== undefined && DataAdapter.isPluralValue(fragment.value)) {
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

				if (fragment.modified > translation.modified) {
					outdatedLocales.push(locale);
				}
				if (!DataAdapter.valueTypeEquals(fragment.value, translation.value)) {
					typeMismatchLocales.push(locale);
				}

				if (DataAdapter.isPluralValue(translation.value)) {
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
					const fragmentData = this.#dataAdapter.getSyncFragment(sourceId, fragment);
					// eslint-disable-next-line @typescript-eslint/prefer-optional-chain
					if (fragmentData !== undefined && fragmentData.value !== null) {
						for (let i = 0; i < translatedLocales.length; i++) {
							const locale = translatedLocales[i];
							const translation = fragmentData.translations[locale];
							if (translation !== undefined
								&& DataAdapter.valueTypeEquals(fragmentData.value, translation.value)
								&& (options.includeOutdated || fragmentData.modified <= translation.modified)) {
								addValue(locale, options.namespace, fragment.fragmentId!, DataAdapter.toRawValue(translation.value));
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
			version: 2,
			locales: {},
			files: {},
		};

		options.localeDataFilenames.forEach((filename, locale) => {
			manifest.locales[locale] = Manifest.filenameToFileId(options.manifestFilename, filename);
		});

		const files = new Map<string, Set<string>>();

		this.#sources.forEach(source => {
			const filenames = source.getOutputFilenames?.();

			const fileIds = (filenames === undefined || filenames.length === 0)
				? [Manifest.GLOBAL_FILE_ID]
				: filenames.map(filename => Manifest.filenameToFileId(options.manifestFilename!, filename));

			for (const fileId of fileIds) {
				let fragmentIds = files.get(fileId);
				if (fragmentIds === undefined) {
					fragmentIds = new Set();
					files.set(fileId, fragmentIds);
				}

				const fragments = source.fragments;
				for (let i = 0; i < fragments.length; i++) {
					const fragmentId = fragments[i].fragmentId;
					if (fragmentId !== undefined) {
						fragmentIds.add(fragmentId);
					}
				}
			}
		});

		for (const [fileId, fragmentIds] of files) {
			manifest.files[fileId] = {
				namespaces: {
					[options.namespace]: {
						fragmentIds: Array.from(fragmentIds),
					},
				},
			};
		}

		return manifest;
	}
}

export declare namespace DataProcessor {
	export interface Options {
		/**
		 * The data adapter to use.
		 */
		dataAdapter: DataAdapter;

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
		/** True to allow modifying sources */
		modify?: boolean;
		/** How to handle discarding obsolete fragments */
		discardObsolete?: DiscardObsoleteFragmentType;
	}

	export interface UpdateResult {
		/** Map of source ids to update results where the source is modified */
		modifiedSources: Map<string, Source.UpdateResult>;
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

	export interface GenerateManifestOptions {
		/** The project namespace. */
		namespace: string;
		/** The absolute manifest filename. */
		manifestFilename: string;
		/** Map of locale codes to absolute output locale data filenames. */
		localeDataFilenames: Map<string, string>;
	}
}

class IdSet implements DataAdapter.IdSet {
	#target: ReadonlyMap<string, unknown>;

	constructor(target: ReadonlyMap<string, unknown>) {
		this.#target = target;
	}

	has(fragmentId: string): boolean {
		return this.#target.has(fragmentId);
	}

	ids() {
		return this.#target.keys();
	}
}
