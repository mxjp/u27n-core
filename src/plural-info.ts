import { pluralInfo } from "./generated/plural-info.js";
import { LocaleCode } from "./runtime/locale-code.js";

export interface PluralInfo {
	readonly formCount: number;
}

export function getPluralInfo(locale: string): PluralInfo | undefined {
	return pluralInfo.get(locale) ?? pluralInfo.get(LocaleCode.parse(locale).language);
}
