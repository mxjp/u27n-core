import { PluralInfo } from "../plural-info.js";
import { TranslationData } from "../translation-data.js";

export interface Options {
	configFilename: string;
	watchDelay?: number;
}

export interface LocaleInfo {
	locale: string;
	pluralInfo?: PluralInfo;
}

export interface ProjectInfo {
	sourceLocale: LocaleInfo;
	translatedLocales: LocaleInfo[];
}

export interface SetTranslationRequest {
	fragmentId: string;
	locale: string;
	value: TranslationData.Value;
}
