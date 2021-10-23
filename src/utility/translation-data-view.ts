import type { Source } from "../source.js";
import type { TranslationData } from "../translation-data.js";

/**
 * Utility for efficient modifying and querying project data objects.
 */
export class TranslationDataView {
	public readonly data: TranslationData;

	/**
	 * Indicates if the data in this data view has been modified.
	 */
	public modified = false;

	/** A map of source ids to sets of fragment ids. */
	private readonly _sources = new Map<string, Set<string>>();

	public constructor(data?: TranslationData) {
		if (data === undefined) {
			this.data = {
				version: 1,
				fragments: {},
				obsolete: [],
			};
		} else {
			if (data.version !== 1) {
				throw new TypeError("unsupported data version");
			}
			this.data = data;
			for (const fragmentId in data.fragments) {
				this._addSourceFragmentPair(data.fragments[fragmentId].sourceId, fragmentId);
			}
		}
	}

	/**
	 * Update a fragment.
	 *
	 * If there are no translations and the update contains an old id, the translations
	 * of the old fragment are copied if possible and marked as outdated.
	 *
	 * @throws an error if the fragment value is undefined.
	 */
	public updateFragment(sourceId: string, fragmentId: string, update: Source.FragmentUpdate): void {
		const existingFragment = this.data.fragments[fragmentId];
		if (existingFragment) {
			if (!TranslationDataView.jsonEquals(existingFragment.value, update.value)) {
				existingFragment.value = update.value ?? null;
				existingFragment.modified = TranslationDataView.createTimestamp();
				this.modified = true;
			}
			if (existingFragment.enabled !== update.enabled) {
				existingFragment.enabled = update.enabled;
				this.modified = true;
			}
			if (existingFragment.sourceId !== sourceId) {
				this._removeSourceFragmentPair(existingFragment.sourceId, fragmentId);
				existingFragment.sourceId = sourceId;
				this._addSourceFragmentPair(sourceId, fragmentId);
				this.modified = true;
			}
		} else {
			const oldTranslations = update.oldFragmentId === undefined
				? undefined
				: this.data.fragments[update.oldFragmentId]?.translations;

			this.data.fragments[fragmentId] = {
				sourceId,
				enabled: update.enabled,
				value: update.value ?? null,
				modified: TranslationDataView.createTimestamp(),
				translations: oldTranslations === undefined ? {} : TranslationDataView.cloneJson(oldTranslations),
			};
			this._addSourceFragmentPair(sourceId, fragmentId);
			this.modified = true;
		}
	}

	/**
	 * Remove fragments of a specific source that match a filter.
	 */
	public removeFragmentsOfSource(sourceId: string, filter?: TranslationDataView.FragmentFilter): void {
		this._sources.get(sourceId)?.forEach(fragmentId => {
			const fragment = this.data.fragments[fragmentId];
			if (!filter || filter(fragmentId, fragment)) {
				this._removeFragment(fragmentId, fragment);
			}
		});
	}

	/**
	 * Remove fragments that match a filter.
	 */
	public removeFragments(filter: TranslationDataView.FragmentFilter): void {
		for (const fragmentId in this.data.fragments) {
			const fragment = this.data.fragments[fragmentId];
			if (filter(fragmentId, fragment)) {
				this._removeFragment(fragmentId, fragment);
			}
		}
	}

	/**
	 * Remove all fragments of all sources that match the filter.
	 */
	public removeSources(filter: TranslationDataView.SourceFilter): void {
		this._sources.forEach((fragmentIds, sourceId) => {
			if (filter(sourceId)) {
				fragmentIds.forEach(fragmentId => {
					this._removeFragment(fragmentId, this.data.fragments[fragmentId]);
				});
			}
		});
	}

	/**
	 * Check if a fragment is in sync with this translation data.
	 *
	 * @returns true if the fragment has a value and the value, source id and enabled flag matches the translation data.
	 * @throws An error if the fragment has no id.
	 */
	public isInSync(sourceId: string, fragment: Source.Fragment): boolean {
		if (fragment.fragmentId === undefined) {
			throw new Error("fragment must have a fragment id");
		}
		if (fragment.value !== undefined) {
			const data = this.data.fragments[fragment.fragmentId];
			return data !== undefined
				&& data.sourceId === sourceId
				&& TranslationDataView.jsonEquals(fragment.value, data.value)
				&& fragment.enabled === data.enabled;
		}
		return false;
	}

	/**
	 * Internal function to remove a fragment.
	 */
	private _removeFragment(fragmentId: string, fragment: TranslationData.Fragment): void {
		this._removeSourceFragmentPair(fragment.sourceId, fragmentId);
		delete this.data.fragments[fragmentId];
		if (Object.keys(fragment.translations).length > 0) {
			this.data.obsolete.push([fragmentId, fragment]);
		}
		this.modified = true;
	}

	/**
	 * Internal function that must be called when a new sourceId/fragmentId pair has been added.
	 */
	private _addSourceFragmentPair(sourceId: string, fragmentId: string): void {
		const fragmentIds = this._sources.get(sourceId);
		if (fragmentIds) {
			fragmentIds.add(fragmentId);
		} else {
			this._sources.set(sourceId, new Set([fragmentId]));
		}
	}

	/**
	 * Internal function that must be called when a new sourceId/fragmentId pair has been removed.
	 */
	private _removeSourceFragmentPair(sourceId: string, fragmentId: string): void {
		const fragmentIds = this._sources.get(sourceId);
		if (fragmentIds?.delete(fragmentId) && fragmentIds.size === 0) {
			this._sources.delete(sourceId);
		}
	}

	/**
	 * Utility for checking if two json serializable values are deeply equal.
	 */
	private static jsonEquals<T>(a: T, b: T): boolean {
		return JSON.stringify(a) === JSON.stringify(b);
	}

	/**
	 * Utility for cloning a json serializable value.
	 */
	private static cloneJson<T>(value: T): T {
		return JSON.parse(JSON.stringify(value)) as T;
	}

	/**
	 * Get a timestamp that can be used in the data object json format.
	 */
	private static createTimestamp(date: Date = new Date()): string {
		return date.toISOString();
	}
}

export declare namespace TranslationDataView {
	/**
	 * Filter function for fragments that returns true to indicate a match.
	 */
	export type FragmentFilter = (fragmentId: string, fragment: TranslationData.Fragment) => boolean;

	/**
	 * Filter function for sources that returns true to indicate a match.
	 */
	export type SourceFilter = (sourceId: string) => boolean;
}
