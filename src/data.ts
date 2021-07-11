
/**
 * Json format that contains translation data for a project.
 */
export interface Data {
	/**
	 * The version.
	 *
	 * This number is increased when fields are removed or the format or semantic of existing fields is changed.
	 */
	version: 1;

	/** The locale of source values */
	sourceLocale: string;

	/** A map of fragment ids to their translation sets */
	values: Record<string, Data.TranslationSet>;

	/** An array of values that were removed */
	obsolete: Data.ObsoleteItem[];
}

export namespace Data {
	/** A value with multiple plural forms */
	export interface PluralValue {
		type: "plural";
		/** An array with all plural forms for the current locale */
		value: string[];
	}

	export type Value = string | PluralValue;

	export interface TranslationSet extends Translation {
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
	export type ObsoleteItem = [string, TranslationSet];
}
