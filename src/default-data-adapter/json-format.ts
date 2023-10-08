import { DataAdapter } from "../data-adapter.js";

export interface DataJsonV1 {
	/**
	 * The format version.
	 *
	 * This is 1 for now, but will be incremented if breaking changes are made.
	 */
	version: 1;

	/**
	 * An object with fragment ids as keys ans fragment information as values.
	 *
	 * Fragments are sorted by fragment id.
	 */
	fragments: Record<string, DataJsonV1.Fragment>;

	/**
	 * An array with tuples of fragment ids and fragment information that are obsolete.
	 */
	obsolete: [string, DataJsonV1.Fragment][];
}

export declare namespace DataJsonV1 {
	export interface Fragment extends Translation {
		/**
		 * The source id of the fragment.
		 *
		 * The context for resolving the source id depends on the project
		 * configuration, not the path of the translation data file.
		 */
		sourceId: string;

		/**
		 * The enabled flag of the fragment.
		 */
		enabled: boolean;

		/**
		 * An object with locale codes as keys and translations as values.
		 *
		 * Translations are sorted by locale code.
		 */
		translations: Record<string, Translation>;
	}

	export interface Translation {
		/**
		 * The value.
		 */
		value: DataAdapter.Value;

		/**
		 * The time when this value was last modified in the format `YYYY-MM-DDTHH:MM:SS.mmmZ`.
		 */
		modified: string;
	}
}

/**
 * Represents the json format used by the default data adapter.
 *
 * This interface will always represent the latest version of the format. If a
 * non breaking type is needed, use the {@link DataJsonV1} type instead.
 */
export type DataJson = DataJsonV1;
export declare namespace DataJson {
	export type Fragment = DataJsonV1.Fragment;
	export type Translation = DataJsonV1.Translation;
}
