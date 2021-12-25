
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
