import { DataProcessor } from "../data-processor.js";
import { PluralInfo } from "../plural-info.js";
import { TranslationData } from "../translation-data.js";

export interface Options {
	configFilename: string;
	watchDelay?: number;
	pendingChanges?: DataProcessor.PendingChanges;
	backupPendingChanges?: number;
}

export interface LocaleInfo {
	locale: string;
	pluralInfo?: PluralInfo;
}

export interface ProjectInfo {
	sourceLocale: LocaleInfo;
	translatedLocales: LocaleInfo[];
}

export interface ProjectUpdateInfo {
	cause: ProjectUpdateCause;
}

export type ProjectUpdateCause
	= "save-changes"
	| "discard-changes"
	| "diagnostics";

export interface SetTranslationRequest {
	fragmentId: string;
	locale: string;
	value: TranslationData.Value;
}
