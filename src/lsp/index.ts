import { pathToFileURL } from "url";
import * as lsp from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

import { Project } from "..";
import { Config } from "../config.js";
import { Diagnostic, DiagnosticLocation, DiagnosticSeverity, getDiagnosticLocations, getDiagnosticMessage, getDiagnosticSeverity } from "../diagnostics.js";
import { Source } from "../source.js";
import { NodeFileSystem } from "../utility/file-system-node.js";
import { LspOptions } from "./options.js";

const connection = lsp.createConnection(lsp.ProposedFeatures.all);
const documents = new lsp.TextDocuments(TextDocument);

let project: Project | null = null;

const LSP_SEVERITY: Record<DiagnosticSeverity, lsp.DiagnosticSeverity | null> = {
	ignore: null,
	info: lsp.DiagnosticSeverity.Information,
	warning: lsp.DiagnosticSeverity.Warning,
	error: lsp.DiagnosticSeverity.Error,
};

connection.onInitialize(async params => {
	const options = params.initializationOptions as LspOptions;

	const config = await Config.read(options.configFilename);

	project = await Project.create({
		config,
		fileSystem: new NodeFileSystem(),
	});

	project.watch({
		delay: options.watchDelay ?? 100,
		output: false,
		modify: false,
		fragmentDiagnostics: true,

		onDiagnostics: diagnostics => {
			const lspDiagnostics = new Map<string | null, lsp.Diagnostic[]>();

			function addDiagnostic(diagnostic: Diagnostic, location: DiagnosticLocation | null) {
				const severity = LSP_SEVERITY[getDiagnosticSeverity(config.diagnostics, diagnostic.type)];
				if (severity === null) {
					return;
				}

				const lspDiagnostic: lsp.Diagnostic = {
					message: getDiagnosticMessage(diagnostic),
					source: "U27N",
					severity,
					range: location?.type === "fragment" && location.source
						? {
							start: location.source.lineMap.getPosition(location.start) ?? { line: 0, character: 0 },
							end: location.source.lineMap.getPosition(location.end) ?? { line: 0, character: 0 },
						}
						: {
							start: { line: 0, character: 0 },
							end: { line: 0, character: 0 },
						},
				};

				const sourceId = location?.sourceId ?? null;
				const array = lspDiagnostics.get(sourceId);
				if (array === undefined) {
					lspDiagnostics.set(sourceId, [lspDiagnostic]);
				} else {
					array.push(lspDiagnostic);
				}
			}

			diagnostics.forEach(diagnostic => {
				const locations = getDiagnosticLocations(config.context, project!.dataProcessor, diagnostic);
				if (locations.length > 0) {
					locations.forEach(location => {
						addDiagnostic(diagnostic, location);
					});
				} else {
					addDiagnostic(diagnostic, null);
				}
			});

			lspDiagnostics.forEach((diagnostics, sourceId) => {
				connection.sendDiagnostics({
					uri: pathToFileURL(sourceId === null
						? options.configFilename
						: Source.sourceIdToFilename(config.context, sourceId)).toString(),
					diagnostics,
				});
			});
		},
	});

	return {
		capabilities: {
			textDocumentSync: lsp.TextDocumentSyncKind.Incremental,
		},
	};
});

documents.listen(connection);
connection.listen();
