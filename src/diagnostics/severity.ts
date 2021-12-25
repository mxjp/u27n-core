import { DiagnosticType } from "./types.js";

export type DiagnosticSeverity = "error" | "warning" | "info" | "ignore";

export type DiagnosticSeverityConfig = {
	"*"?: DiagnosticSeverity;
} & {
	[type in DiagnosticType]?: DiagnosticSeverity;
};

export function getDiagnosticSeverity(config: DiagnosticSeverityConfig, type: DiagnosticType): DiagnosticSeverity {
	return config[type] ?? config["*"] ?? "error";
}
