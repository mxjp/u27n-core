
export interface PluralProcessor {
	/**
	 * Choose a plural form for the specified count.
	 *
	 * @param value The plural value to choose from.
	 * @param count The count to choose the plural form for.
	 */
	(value: string[], count: number): string;
}
