
/**
 * Json format that contains translation data for a project.
 */
export interface TranslationData {
	/**
	 * The version.
	 *
	 * This number is increased when fields are removed or the format or semantic of existing fields is changed.
	 */
	version: 1;

	/** A map of fragment ids to fragments */
	fragments: Record<string, TranslationData.Fragment>;

	/** An array of values that were removed */
	obsolete: TranslationData.ObsoleteItem[];
}

export namespace TranslationData {
	/** A value with multiple plural forms */
	export interface PluralValue {
		type: "plural";
		/** An array with all plural forms for the current locale */
		value: string[];
	}

	export type Value = null | string | PluralValue;

	/**
	 * A translation set contains all information on a fragment
	 * that is extracted from it's source file as well as all
	 * translations for that fragment.
	 */
	export interface Fragment extends Translation {
		/** The source id. */
		sourceId: string;
		/** False if the value is commented out in the source code */
		enabled: boolean;
		/** A map of locales to translations */
		translations: Record<string, Translation>;
	}

	export interface Translation {
		/** The value */
		value: Value;

		/**
		 * The last time this value was modified.
		 *
		 * This must always be a UTC ISO-8601 string in the format `YYYY-MM-DDTHH:mm:ss.sssZ` or `±YYYYYY-MM-DDTHH:mm:ss.sssZ`
		 */
		modified: string;
	}

	/**
	 * A pair of fragment id and translation set.
	 */
	export type ObsoleteItem = [string, Fragment];

	export function parseJson(json: string): TranslationData {
		return JSON.parse(json) as TranslationData;
	}

	export function formatJson(data: TranslationData, sorted: boolean): string {
		if (sorted) {
			const fragments = Object.entries(data.fragments);
			fragments.sort(([a], [b]) => a > b ? 1 : (a < b ? -1 : 0));

			const obsolete = Array.from(data.obsolete);
			obsolete.sort(([ai, af], [bi, bf]) => ai > bi ? 1 : (ai < bi ? -1 : Date.parse(af.modified) - Date.parse(bf.modified)));

			data = {
				version: data.version,
				fragments: Object.fromEntries(fragments),
				obsolete: obsolete,
			};
		}
		return JSON.stringify(data, null, "\t") + "\n";
	}

	export function clone(data: TranslationData): TranslationData {
		return JSON.parse(JSON.stringify(data)) as TranslationData;
	}
}
