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

	public constructor(options: Project.Options = {}) {
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
	 * Apply updates from disk to the project.
	 */
	public applyUpdate(update: Project.Update): Project.UpdateResult {
		const modifiedSources = new Map<string, string>();

		if (update.translationData) {
			this.#translationDataView = new TranslationDataView(update.translationData);
			// TODO: Only update the view if translation data has changed.
			// TODO: Process all current sources as updated.
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

			if (source.update) {
				const updateResult = source.update({
					updateId: fragment => {
						if (
							fragment.fragmentId !== undefined
							&& !assignedFragmentIds.has(fragment.fragmentId)
							&& (
								!this.#sourceFragments.hasOtherSources(sourceId, fragment.fragmentId)
								|| this.#translationDataView.isInSync(sourceId, fragment)
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
					if (assignedFragmentIds.has(fragmentId) || this.#sourceFragments.hasOtherSources(sourceId, fragmentId)) {
						// TODO: Emit diagnostic for duplicate static fragment id.
					} else if (fragment.value !== undefined) {
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
		});

		update.removedSources?.forEach(sourceId => {
			this.#sources.delete(sourceId);
		});

		this.#translationDataView.removeSources(sourceId => {
			return !this.#sources.has(sourceId);
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
