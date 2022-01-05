import { DataProcessor } from "./data-processor.js";
import { Source } from "./source.js";

export type Diagnostic = {
	type: "missingTranslations" | "outdatedTranslations" | "unknownTranslations" | "valueTypeMismatch";
	sourceId: string;
	fragmentId: string;
	locales: string[];
} | {
	type: "duplicateFragment";
	sourceIds: string[];
	fragmentId: string;
} | {
	type: "unsupportedSource";
	sourceId: string;
} | {
	type: "projectOutOfSync";
};

export type DiagnosticType = Diagnostic["type"];

export const diagnosticTypes = new Set<DiagnosticType>([
	"missingTranslations",
	"outdatedTranslations",
	"unknownTranslations",
	"unsupportedSource",
	"projectOutOfSync",
]);

export type DiagnosticSeverity = "error" | "warning" | "info" | "ignore";

export type DiagnosticSeverityConfig = {
	"*"?: DiagnosticSeverity;
} & {
	[type in DiagnosticType]?: DiagnosticSeverity;
};

export function getDiagnosticSeverity(config: DiagnosticSeverityConfig, type: DiagnosticType): DiagnosticSeverity {
	return config[type] ?? config["*"] ?? "error";
}

export type DiagnosticLocation
	= FileDiagnosticLocation
	| FragmentDiagnosticLocation;

export interface FileDiagnosticLocation {
	type: "file";
	sourceId: string;
	filename: string;
	source?: Source;
}

export interface FragmentDiagnosticLocation {
	type: "fragment";
	sourceId: string;
	filename: string;
	source: Source;
	start: number;
	end: number;
}

export function getDiagnosticLocations(rootDir: string, dataProcessor: DataProcessor, diagnostic: Diagnostic): DiagnosticLocation[] {
	switch (diagnostic.type) {
		case "missingTranslations":
		case "outdatedTranslations":
		case "unknownTranslations":
		case "valueTypeMismatch": {
			const source = dataProcessor.getSource(diagnostic.sourceId);
			const filename = Source.sourceIdToFilename(rootDir, diagnostic.sourceId);
			if (source === undefined) {
				return [{
					type: "file",
					sourceId: diagnostic.sourceId,
					filename,
				}];
			}
			const fragment = source.fragmentMap.get(diagnostic.fragmentId);
			if (fragment === undefined) {
				return [{
					type: "file",
					sourceId: diagnostic.sourceId,
					filename,
					source,
				}];
			}
			return [{
				type: "fragment",
				sourceId: diagnostic.sourceId,
				filename,
				source,
				start: fragment.start,
				end: fragment.end,
			}];
		}

		case "duplicateFragment":
			return diagnostic.sourceIds.map(sourceId => {
				const source = dataProcessor.getSource(sourceId);
				const filename = Source.sourceIdToFilename(rootDir, sourceId);
				if (source === undefined) {
					return {
						type: "file",
						sourceId,
						filename,
					};
				}
				const fragment = source.fragmentMap.get(diagnostic.fragmentId);
				if (fragment === undefined) {
					return {
						type: "file",
						sourceId,
						filename,
						source,
					};
				}
				return {
					type: "fragment",
					sourceId,
					filename,
					source,
					start: fragment.start,
					end: fragment.end,
				};
			});

		case "unsupportedSource":
			return [{
				type: "file",
				sourceId: diagnostic.sourceId,
				filename: Source.sourceIdToFilename(rootDir, diagnostic.sourceId),
			}];

		case "projectOutOfSync":
			return [];
	}
}

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

		case "valueTypeMismatch":
			return `Fragment ${string(diagnostic.fragmentId)} has a translation with a wrong value type for locale(s) ${list(diagnostic.locales)}.`;

		case "duplicateFragment":
			return `Duplicate fragment id ${string(diagnostic.fragmentId)}.`;

		case "unsupportedSource":
			return `Source ${string(diagnostic.sourceId)} could not be parsed.`;

		case "projectOutOfSync":
			return `Translation data and sources are not in sync.`;
	}
}
