import { Base62FragmentIdGenerator, FragmentIdGenerator } from "./fragment-id-generator.js";
import type { Source } from "./source.js";
import type { TranslationData } from "./translation-data.js";
import { SourceFragmentMap } from "./utility/source-fragment-map.js";
import { TranslationDataView } from "./utility/translation-data-view.js";

export class Project {
	/**
	 * The default fragment id generator that is used if
	 * the source does not provide it's own generator.
	 */
	private readonly _fragmentIdGenerator: FragmentIdGenerator;

	/**
	 * Indicates if the fragment id generator has been prepared.
	 */
	private _fragmentIdGeneratorPrepared = false;

	/**
	 * The current translation data view that is used.
	 *
	 * This is only modified while updates are processed.
	 */
	private _translationDataView = new TranslationDataView();

	/**
	 * Map of current source ids to source instances.
	 */
	private readonly _sources = new Map<string, Source>();

	/**
	 * Map of source ids to fragment ids.
	 */
	private readonly _sourceFragments = new SourceFragmentMap();

	public constructor(options: Project.Options = {}) {
		this._fragmentIdGenerator = options.fragmentIdGenerator ?? new Base62FragmentIdGenerator();
	}

	/**
	 * Get the current translation data that is managed by this project.
	 */
	public get translationData(): TranslationData {
		return this._translationDataView.data;
	}

	/**
	 * Get or set if the translation data that is managed by this project has been modified by applying an update.
	 */
	public get translationDataModified(): boolean {
		return this._translationDataView.modified;
	}

	public set translationDataModified(value: boolean) {
		this._translationDataView.modified = value;
	}

	/**
	 * Apply updates from disk to the project.
	 */
	public applyUpdate(update: Project.Update): Project.UpdateResult {
		const modifiedSources = new Map<string, string>();

		if (update.translationData) {
			this._translationDataView = new TranslationDataView(update.translationData);
			// TODO: Only update the view if translation data has changed.
			// TODO: Process all current sources as updated.
		}

		update.updatedSources?.forEach((source, sourceId) => {
			this._sourceFragments.updateSource(sourceId, source.fragmentMap);
		});
		update.removedSources?.forEach(sourceId => {
			this._sourceFragments.removeSource(sourceId);
		});

		if (!this._fragmentIdGeneratorPrepared) {
			this._fragmentIdGeneratorPrepared = true;
			this._fragmentIdGenerator.prepare?.(this._sourceFragments.fragmentToSources);
		}

		const assignedFragmentIds = new Set<string>();

		update.updatedSources?.forEach((source, sourceId) => {
			this._sources.set(sourceId, source);

			if (source.update) {
				const updateResult = source.update({
					updateId: fragment => {
						if (
							fragment.fragmentId !== undefined
							&& !assignedFragmentIds.has(fragment.fragmentId)
							&& (
								!this._sourceFragments.hasOtherSources(sourceId, fragment.fragmentId)
								|| this._translationDataView.isInSync(sourceId, fragment)
							)
						) {
							assignedFragmentIds.add(fragment.fragmentId);
							return fragment.fragmentId;
						}

						const generator = source.fragmentIdGenerator ?? this._fragmentIdGenerator;

						let id: string;
						do {
							id = generator.generate();
						} while (assignedFragmentIds.has(id) || this._sourceFragments.hasFragment(id));
						assignedFragmentIds.add(id);
						return id;
					},
				});

				if (updateResult.modified) {
					modifiedSources.set(sourceId, updateResult.content);
				}

				updateResult.fragments.forEach((update, fragmentId) => {
					this._translationDataView.updateFragment(sourceId, fragmentId, update);
				});
				this._translationDataView.removeFragmentsOfSource(sourceId, fragmentId => {
					return !updateResult.fragments.has(fragmentId);
				});
			} else {
				const staticFragments = source.fragmentMap;
				staticFragments.forEach((fragment, fragmentId) => {
					if (assignedFragmentIds.has(fragmentId) || this._sourceFragments.hasOtherSources(sourceId, fragmentId)) {
						// TODO: Emit diagnostic for duplicate static fragment id.
					} else if (fragment.value !== undefined) {
						assignedFragmentIds.add(fragmentId);
						this._translationDataView.updateFragment(sourceId, fragmentId, {
							enabled: fragment.enabled,
							value: fragment.value,
							oldFragmentId: undefined,
						});
					}
				});
				this._translationDataView.removeFragmentsOfSource(sourceId, fragmentId => {
					return !staticFragments.has(fragmentId);
				});
			}
		});

		update.removedSources?.forEach(sourceId => {
			this._sources.delete(sourceId);
		});

		this._translationDataView.removeSources(sourceId => {
			return !this._sources.has(sourceId);
		});

		return { modifiedSources };
	}
}

export declare namespace Project {
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
	}

	export interface UpdateResult {
		/** Map of source ids to modified content to write to disk */
		modifiedSources: Map<string, string>;
	}
}
