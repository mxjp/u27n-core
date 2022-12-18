import { fileURLToPath, pathToFileURL } from "node:url";
import { inspect } from "node:util";

import * as lsp from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

import { Project } from "..";
import { Config } from "../config.js";
import { DataProcessor } from "../data-processor.js";
import { Diagnostic, DiagnosticLocation, DiagnosticSeverity, getDiagnosticLocations, getDiagnosticMessage, getDiagnosticSeverity } from "../diagnostics.js";
import { getPluralInfo } from "../plural-info.js";
import { Source } from "../source.js";
import { TranslationData } from "../translation-data.js";
import { debounce } from "../utility/debounce.js";
import { NodeFileSystem } from "../utility/file-system-node.js";
import type { LocaleInfo, Options, ProjectInfo, ProjectUpdateInfo, SetTranslationRequest } from "./types.js";

const connection = lsp.createConnection(lsp.ProposedFeatures.all);
const documents = new lsp.TextDocuments(TextDocument);
const fileSystem = new NodeFileSystem();

let project: Project | null = null;
let backupPendingChanges: (() => void) | null = null;

const LSP_SEVERITY: Record<DiagnosticSeverity, lsp.DiagnosticSeverity | null> = {
	ignore: null,
	info: lsp.DiagnosticSeverity.Information,
	warning: lsp.DiagnosticSeverity.Warning,
	error: lsp.DiagnosticSeverity.Error,
};

documents.onDidChangeContent(event => {
	void fileSystem.overwrite(fileURLToPath(event.document.uri), event.document.getText());
});

documents.onDidClose(event => {
	void fileSystem.overwrite(fileURLToPath(event.document.uri), null);
});

connection.onInitialize(async params => {
	try {
		const options = params.initializationOptions as Options;
		connection.console.info(`Using options: ${inspect(options, false, 99, false)}`);

		const config = await Config.read(options.configFilename);
		connection.console.info(`Using config: ${inspect(config, false, 99, false)}`);

		project = await Project.create({
			config,
			fileSystem,
		});

		if (options.pendingChanges) {
			project.dataProcessor.importPendingChanges(options.pendingChanges);
		}

		if (options.backupPendingChanges !== undefined) {
			backupPendingChanges = debounce(options.backupPendingChanges, () => {
				void connection.sendNotification("u27n/backup-pending-changes", project!.dataProcessor.exportPendingChanges());
			});
		}

		connection.onRequest("u27n/get-project-info", (): ProjectInfo => {
			function getLocaleInfo(locale: string): LocaleInfo {
				return {
					locale,
					pluralInfo: getPluralInfo(locale),
				};
			}
			return {
				sourceLocale: getLocaleInfo(config.sourceLocale),
				translatedLocales: config.translatedLocales.map(getLocaleInfo),
			};
		});

		connection.onRequest("u27n/get-editable-fragments", (sourceFilename: string): DataProcessor.EditableFragment[] | null => {
			const sourceId = Source.filenameToSourceId(project!.config.context, sourceFilename);
			return project!.dataProcessor.getEditableFragments(sourceId) ?? null;
		});

		connection.onRequest("u27n/set-translation", (req: SetTranslationRequest) => {
			project!.dataProcessor.setTranslation(req.fragmentId, req.locale, req.value);
			backupPendingChanges?.();
		});

		connection.onRequest("u27n/save-changes", async () => {
			const data = project!.dataProcessor.applyPendingChanges();
			await fileSystem.writeFile(config.translationData.filename, TranslationData.formatJson(data, config.translationData.sorted));
			project!.dataProcessor.discardPendingChanges();
			backupPendingChanges?.();
			await connection.sendNotification("u27n/project-update", {
				cause: "save-changes",
			} as ProjectUpdateInfo);
		});

		connection.onRequest("u27n/discard-changes", async () => {
			project!.dataProcessor.discardPendingChanges();
			backupPendingChanges?.();
			await connection.sendNotification("u27n/project-update", {
				cause: "discard-changes",
			} as ProjectUpdateInfo);
		});

		let previousDiagnosticFileUris: string[] = [];

		project.watch({
			delay: options.watchDelay ?? 100,
			output: false,
			modify: false,
			fragmentDiagnostics: true,

			onDiagnostics: async diagnostics => {
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

				const clearDiagnosticFileUris = new Set(previousDiagnosticFileUris);
				previousDiagnosticFileUris = [];

				for (const [sourceId, diagnostics] of lspDiagnostics) {
					const uri = pathToFileURL(sourceId === null
						? options.configFilename
						: Source.sourceIdToFilename(config.context, sourceId)).toString();

					clearDiagnosticFileUris.delete(uri);
					previousDiagnosticFileUris.push(uri);

					await connection.sendDiagnostics({ uri, diagnostics });
				}

				for (const uri of clearDiagnosticFileUris) {
					await connection.sendDiagnostics({ uri, diagnostics: [] });
				}

				await connection.sendNotification("u27n/project-update", {
					cause: "diagnostics",
				} as ProjectUpdateInfo);
			},
		});

		connection.console.info(`Watching project...`);

		return {
			capabilities: {
				textDocumentSync: lsp.TextDocumentSyncKind.Incremental,
			},
		};
	} catch (error) {
		throw new Error(inspect(error, false, 99, false));
	}
});

documents.listen(connection);
connection.listen();
