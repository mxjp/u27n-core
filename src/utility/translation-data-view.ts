import { DiscardObsoleteFragmentType } from "../obsolete-handling.js";
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
	readonly #sources = new Map<string, Set<string>>();

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
				this.#addSourceFragmentPair(data.fragments[fragmentId].sourceId, fragmentId);
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
			if (!TranslationDataView.#jsonEquals(existingFragment.value, update.value)) {
				existingFragment.value = update.value ?? null;
				existingFragment.modified = TranslationDataView.#createTimestamp();
				this.modified = true;
			}
			if (existingFragment.enabled !== update.enabled) {
				existingFragment.enabled = update.enabled;
				this.modified = true;
			}
			if (existingFragment.sourceId !== sourceId) {
				this.#removeSourceFragmentPair(existingFragment.sourceId, fragmentId);
				existingFragment.sourceId = sourceId;
				this.#addSourceFragmentPair(sourceId, fragmentId);
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
				modified: TranslationDataView.#createTimestamp(),
				translations: oldTranslations === undefined ? {} : TranslationDataView.#cloneJson(oldTranslations),
			};
			this.#addSourceFragmentPair(sourceId, fragmentId);
			this.modified = true;
		}
	}

	/**
	 * Remove fragments of a specific source that match a filter.
	 */
	public removeFragmentsOfSource(sourceId: string, discardObsolete: DiscardObsoleteFragmentType, filter?: TranslationDataView.FragmentFilter): void {
		this.#sources.get(sourceId)?.forEach(fragmentId => {
			const fragment = this.data.fragments[fragmentId];
			if (!filter || filter(fragmentId, fragment)) {
				this.#removeFragment(fragmentId, fragment, discardObsolete);
			}
		});
	}

	/**
	 * Remove all fragments of all sources that match the filter.
	 */
	public removeSources(filter: TranslationDataView.SourceFilter, discardObsolete: DiscardObsoleteFragmentType): void {
		this.#sources.forEach((fragmentIds, sourceId) => {
			if (filter(sourceId)) {
				fragmentIds.forEach(fragmentId => {
					this.#removeFragment(fragmentId, this.data.fragments[fragmentId], discardObsolete);
				});
			}
		});
	}

	/**
	 * Get a translation data fragment if it is in sync with the specified source fragment.
	 *
	 * @returns The translation data fragment if it's value, source id and flags match the source fragment.
	 */
	public getSyncFragment(sourceId: string, fragment: Source.Fragment): TranslationData.Fragment | null {
		if (fragment.fragmentId === undefined) {
			return null;
		}
		if (fragment.value !== null) {
			const data = this.data.fragments[fragment.fragmentId];
			if (data !== undefined
				&& data.sourceId === sourceId
				&& TranslationDataView.#jsonEquals(fragment.value, data.value)
				&& fragment.enabled === data.enabled) {
				return data;
			}
		}
		return null;
	}

	/**
	 * Iterate over all fragments.
	 */
	public forEachFragment(callback: (fragmentId: string, fragment: TranslationData.Fragment) => void): void {
		for (const name in this.data.fragments) {
			callback(name, this.data.fragments[name]);
		}
	}

	/**
	 * Internal function to remove a fragment.
	 */
	#removeFragment(fragmentId: string, fragment: TranslationData.Fragment, discardObsolete: DiscardObsoleteFragmentType): void {
		this.#removeSourceFragmentPair(fragment.sourceId, fragmentId);
		delete this.data.fragments[fragmentId];
		if (!TranslationDataView.#shouldDiscardFragment(fragment, discardObsolete)) {
			this.data.obsolete.push([fragmentId, fragment]);
		}
		this.modified = true;
	}

	/**
	 * Internal function that must be called when a new sourceId/fragmentId pair has been added.
	 */
	#addSourceFragmentPair(sourceId: string, fragmentId: string): void {
		const fragmentIds = this.#sources.get(sourceId);
		if (fragmentIds) {
			fragmentIds.add(fragmentId);
		} else {
			this.#sources.set(sourceId, new Set([fragmentId]));
		}
	}

	/**
	 * Internal function that must be called when a new sourceId/fragmentId pair has been removed.
	 */
	#removeSourceFragmentPair(sourceId: string, fragmentId: string): void {
		const fragmentIds = this.#sources.get(sourceId);
		if (fragmentIds?.delete(fragmentId) && fragmentIds.size === 0) {
			this.#sources.delete(sourceId);
		}
	}

	static #shouldDiscardFragment(fragment: TranslationData.Fragment, type: DiscardObsoleteFragmentType): boolean {
		switch (type) {
			case DiscardObsoleteFragmentType.Outdated: {
				const fragmentModified = TranslationDataView.parseTimestamp(fragment.modified);
				for (const locale in fragment.translations) {
					if (!TranslationDataView.isOutdated(fragmentModified, fragment.translations[locale])) {
						return false;
					}
				}
				return true;
			}

			case DiscardObsoleteFragmentType.Untranslated:
				return Object.keys(fragment.translations).length === 0;

			case DiscardObsoleteFragmentType.All:
				return true;
		}
	}

	/**
	 * Utility for checking if two json serializable values are deeply equal.
	 */
	static #jsonEquals<T>(a: T, b: T): boolean {
		return JSON.stringify(a) === JSON.stringify(b);
	}

	/**
	 * Utility for cloning a json serializable value.
	 */
	static #cloneJson<T>(value: T): T {
		return JSON.parse(JSON.stringify(value)) as T;
	}

	/**
	 * Get a timestamp that can be used in the data object json format.
	 */
	static #createTimestamp(date: Date = new Date()): string {
		return date.toISOString();
	}

	/**
	 * Parse a timestamp used in translation data objects.
	 */
	public static parseTimestamp(timestamp: string): number {
		return Date.parse(timestamp);
	}

	/**
	 * Check if a translation is outdated compared to the parsed date of the fragment.
	 */
	public static isOutdated(fragmentModified: number, translation: TranslationData.Translation): boolean {
		return Date.parse(translation.modified) < fragmentModified;
	}

	/**
	 * Check if two translation data values are of the same type.
	 */
	public static valueTypeEquals(a: TranslationData.Value, b: TranslationData.Value): boolean {
		if (a === null || b === null) {
			return false;
		}
		if (typeof a === "string") {
			return typeof b === "string";
		}
		return typeof b === "string"
			? false
			: a.type === b.type;
	}

	/**
	 * Check if the translation data value is a plural value.
	 */
	public static isPluralValue(value: TranslationData.Value): value is TranslationData.PluralValue {
		return value !== null && typeof value === "object" && value.type === "plural";
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
