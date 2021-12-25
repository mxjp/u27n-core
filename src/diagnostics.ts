import { DataProcessor } from "./data-processor.js";
import { Source } from "./source.js";

export type Diagnostic = {
	type: "missingTranslations";
	sourceId: string;
	fragmentId: string;
	locales: string[];
} | {
	type: "outdatedTranslations";
	sourceId: string;
	fragmentId: string;
	locales: string[];
} | {
	type: "unknownTranslations";
	sourceId: string;
	fragmentId: string;
	locales: string[];
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
	= GlobalDiagnosticLocation
	| FileDiagnosticLocation
	| FragmentDiagnosticLocation;

export interface GlobalDiagnosticLocation {
	type: "global";
}

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

export function getDiagnosticLocation(rootDir: string, dataProcessor: DataProcessor, diagnostic: Diagnostic): DiagnosticLocation {
	switch (diagnostic.type) {
		case "missingTranslations":
		case "outdatedTranslations":
		case "unknownTranslations": {
			const source = dataProcessor.getSource(diagnostic.sourceId);
			const filename = Source.sourceIdToFilename(rootDir, diagnostic.sourceId);
			if (source === undefined) {
				return {
					type: "file",
					sourceId: diagnostic.sourceId,
					filename,
				};
			}
			const fragment = source.fragmentMap.get(diagnostic.fragmentId);
			if (fragment === undefined) {
				return {
					type: "file",
					sourceId: diagnostic.sourceId,
					filename,
					source,
				};
			}
			return {
				type: "fragment",
				sourceId: diagnostic.sourceId,
				filename,
				source,
				start: fragment.start,
				end: fragment.end,
			};
		}

		case "unsupportedSource":
			return {
				type: "file",
				sourceId: diagnostic.sourceId,
				filename: Source.sourceIdToFilename(rootDir, diagnostic.sourceId),
			};

		case "projectOutOfSync":
			return {
				type: "global",
			};
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

		case "unsupportedSource":
			return `Source ${string(diagnostic.sourceId)} could not be parsed.`;

		case "projectOutOfSync":
			return `Translation data and sources are not in sync.`;
	}
}
