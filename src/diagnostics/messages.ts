import { Diagnostic } from "./types.js";

export function getDiagnosticMessage(diagnostic: Diagnostic): string {
	function string(value: string) {
		return JSON.stringify(value);
	}

	function list(locales: string[]) {
		return locales.map(string).join(", ");
	}

	switch (diagnostic.type) {
		case "missingTranslations":
			return `Fragment ${string(diagnostic.fragmentId)} is missing translations for locale(s) ${list(diagnostic.locales)}.`;

		case "outdatedTranslations":
			return `Fragment ${string(diagnostic.fragmentId)} has outdated translations for locale(s) ${list(diagnostic.locales)}.`;

		case "unknownTranslations":
			return `Fragment ${string(diagnostic.fragmentId)} has translations for unknown locale(s) ${list(diagnostic.locales)}.`;

		case "unsupportedSource":
			return `Source ${string(diagnostic.sourceId)} could not be parsed.`;

		case "projectOutOfSync":
			return `Translation data and sources are not in sync.`;
	}
}
