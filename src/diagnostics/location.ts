import { DataProcessor } from "../data-processor.js";
import { Source } from "../source.js";
import { Diagnostic } from "./types.js";

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
