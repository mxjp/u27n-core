import { Config } from "./config.js";
import { DiscardObsoleteFragmentType } from "./obsolete-handling.js";
import { LocaleData } from "./runtime/locale-data.js";
import { Source } from "./source.js";

/**
 * An adapter for reading and modifying translation data for a project.
 */
export interface DataAdapter {
	/**
	 * An arbitrary number that may be incremented by this adapter to hint
	 * that updated data has been loaded from disk or another external source.
	 */
	get revision(): number;

	/**
	 * Called when this adapter should reload or update data from disk.
	 */
	reload(): Promise<void>;

	/**
	 * True if there are unpersisted changes that were made through this adapter.
	 */
	get modified(): boolean;

	/**
	 * Called to persist changes made via this adapter to disk.
	 */
	persist(): Promise<void>;

	/**
	 * Update a fragment.
	 *
	 * If there are no translations yet and the update contains an old id, the translations of the old
	 * fragment should be copied to the new fragment, but marked as outdated if possible.
	 *
	 * @param sourceId The source id in which to update the fragment.
	 * @param fragmentId The fragment id.
	 * @param update The update to apply.
	 */
	updateFragment(sourceId: string, fragmentId: string, update: Source.FragmentUpdate): void;

	/**
	 * Discard all fragments of a specific source except the specified fragment ids.
	 *
	 * @param sourceId The source id to discard fragments from.
	 * @param type How to discard obsolete fragments.
	 * @param keepFragmentIds The set of fragment ids to keep.
	 */
	discardFragments(sourceId: string, type: DiscardObsoleteFragmentType, keepFragmentIds?: DataAdapter.IdSet): void;

	/**
	 * Discard all fragments of all sources except the specified source ids.
	 *
	 * @param type How to discard obsolete fragments.
	 * @param keepSourceIds The set of source ids to keep.
	 */
	discardSources(type: DiscardObsoleteFragmentType, keepSourceIds: DataAdapter.IdSet): void;

	/**
	 * Check if a fragment is in sync with the specified source fragment.
	 *
	 * A fragment is considered "in sync" if it's source id, fragment id, value and enabled flag matches.
	 *
	 * @param sourceId The source id to look in.
	 * @param fragment The source fragment to compare with.
	 * @returns The fragment if it is in sync or undefined otherwise.
	 */
	getSyncFragment(sourceId: string, fragment: Source.Fragment): DataAdapter.Fragment | undefined;

	/**
	 * Iterate over all fragments that are in sync.
	 *
	 * A fragment is considered "in sync" if it's source id, fragment id, value and enabled flag matches.
	 *
	 * @param getSource A function to synchronously get a source instance by it's source id.
	 * @param callback A function to synchronously call for each fragment that is in sync.
	 */
	forEachSyncFragment(getSource: (sourceId: string) => Source | undefined, callback: (fragmentId: string, fragment: DataAdapter.Fragment) => void): void;
}

export namespace DataAdapter {
	export interface IdSet {
		has(fragmentId: string): boolean;
		ids(): Iterable<string>;
	}

	/** A value with multiple plural forms */
	export interface PluralValue {
		type: "plural";
		/** An array with all plural forms for the current locale */
		value: string[];
	}

	/**
	 * Represents a translation value.
	 *
	 * null represents an invalid value.
	 */
	export type Value = null | string | PluralValue;

	export interface Fragment extends Translation {
		/** The source id. */
		sourceId: string;
		/** True if this fragment is enabled. */
		enabled: boolean;
		/** An object with locales as keys and translations as values. */
		translations: Record<string, Translation>;
	}

	export interface Translation {
		/** The value. */
		value: Value;
		/** When this value was last modified in milliseconds since midnight, January 1, 1970 UTC. */
		modified: number;
	}

	export interface CreateContext {
		config: Config;
	}

	/**
	 * Check if two translation values are of the same type.
	 */
	export function valueTypeEquals(a: Value, b: Value): boolean {
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
	 * Check if two translation values are equal.
	 *
	 * Invalid values (nulls) are considered equal.
	 */
	export function valueEquals(a: Value, b: Value): boolean {
		if (isPluralValue(a)) {
			return isPluralValue(b)
				&& a.value.length === b.value.length
				&& a.value.every((v, i) => b.value[i] === v);
		}
		return a === b;
	}

	/**
	 * Check if a value is a string value.
	 */
	export function isStringValue(value: Value): value is string {
		return typeof value === "string";
	}

	/**
	 * Check if a value is a plural value.
	 */
	export function isPluralValue(value: Value): value is PluralValue {
		return value !== null && typeof value === "object" && value.type === "plural";
	}

	/**
	 * Get a raw value that can be used in locale data objects.
	 */
	export function toRawValue(value: Value): LocaleData.Value {
		if (typeof value === "string") {
			return value;
		} else if (value !== null) {
			switch (value.type) {
				case "plural": return value.value;
			}
		}
		throw new Error("invalid value");
	}

	/**
	 * Check if a fragment to discard should be deleted.
	 *
	 * @returns true if the fragment should be deleted, false if it should be kept.
	 */
	export function shouldDeleteFragment(fragment: Fragment, type: DiscardObsoleteFragmentType): boolean {
		switch (type) {
			case "outdated": {
				for (const locale in fragment.translations) {
					if (fragment.modified < fragment.translations[locale].modified) {
						return false;
					}
				}
				return true;
			}

			case "untranslated":
				return Object.keys(fragment.translations).length === 0;

			case "all":
				return true;
		}
	}
}
