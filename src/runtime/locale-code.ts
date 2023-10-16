
/**
 * Represents a locale code.
 */
export class LocaleCode {
	constructor(
		/**
		 * The language part.
		 *
		 * For "en_US", this would be "en".
		 */
		readonly language: string,

		/**
		 * The suffix.
		 *
		 * For "en_US", this would be ["US"].
		 */
		readonly suffix: string[],
	) {}

	/**
	 * Format this locale code.
	 *
	 * @param sep The separator to use. Default is "-".
	 */
	toString(sep = "-"): string {
		return `${this.language}${sep}${this.suffix.join(sep)}`;
	}

	/**
	 * Parse a locale code.
	 *
	 * Note, that this doesn't validate the locale code and should not be used for directly parsing user input.
	 */
	static parse(code: string): LocaleCode {
		const parts = code.split(/[^a-z]/ig);
		return new LocaleCode(parts[0], parts.slice(1));
	}
}
