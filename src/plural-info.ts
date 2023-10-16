import { pluralInfo } from "./generated/plural-info.js";
import { LocaleCode } from "./runtime/locale-code.js";

export interface PluralInfo {
	/**
	 * The number of plural forms that plural values for this locale should have.
	 */
	readonly formCount: number;
}

/**
 * Get plural information for a specific locale.
 *
 * @returns An object with information or undefined if no information is available for the specified locale.
 */
export function getPluralInfo(locale: string): PluralInfo | undefined {
	return pluralInfo.get(locale) ?? pluralInfo.get(LocaleCode.parse(locale).language);
}
