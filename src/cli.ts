#!/usr/bin/env node
import colors from "ansi-colors";
import { readFile, writeFile } from "fs/promises";
import { relative, resolve } from "path";
import parseArgv from "yargs-parser";

import { Config } from "./config.js";
import { DataProcessor } from "./data-processor.js";
import { getDiagnosticLocation } from "./diagnostics/location.js";
import { getDiagnosticMessage } from "./diagnostics/messages.js";
import { DiagnosticSeverity, getDiagnosticSeverity } from "./diagnostics/severity.js";
import { Diagnostic } from "./diagnostics/types.js";
import { Plugin, PluginContext, PluginModule, SetupPluginContext } from "./plugin.js";
import { Source } from "./source.js";
import { TranslationData } from "./translation-data.js";
import { findFiles, watchFiles } from "./utility/file-system.js";

interface Args extends parseArgv.Arguments {
	config?: string;
	watch?: boolean;
	output?: boolean;
	modify?: boolean;
}

const diagnosticColors = new Map<DiagnosticSeverity, colors.StyleFunction>([
	["error", colors.red],
	["warning", colors.yellow],
	["info", colors.cyan],
]);

(async () => {
	const args = parseArgv(process.argv.slice(2), {
		string: ["config"],
		boolean: ["watch", "output", "modify"],
	}) as Args;
	const watch = args.watch ?? false;
	const output = args.output ?? true;
	const modify = args.modify ?? watch;

	const configFilename = resolve(args.config ?? "u27n.json");
	const config = await Config.read(configFilename);

	const setupPluginContext: SetupPluginContext = { config };

	const plugins: Plugin[] = [];
	for (const pluginConfig of config.plugins) {
		const module = await import(pluginConfig.entry) as PluginModule;
		const plugin = typeof module.default === "function" ? new module.default() : module.default;
		await plugin.setup?.(setupPluginContext, pluginConfig.config);
		plugins.push(plugin);
	}

	const dataProcessor = new DataProcessor(setupPluginContext);
	const pluginContext: PluginContext = { config, dataProcessor };

	async function createSource(filename: string): Promise<Source | undefined> {
		const content = await readFile(filename, "utf-8");
		for (const plugin of plugins) {
			const source = plugin.createSource?.(filename, content, pluginContext) as Source | undefined;
			if (source !== undefined) {
				return source;
			}
		}
	}

	function emitDiagnostic(diagnostic: Diagnostic) {
		function formatFilename(filename: string) {
			return relative(process.cwd(), filename);
		}

		const severity = getDiagnosticSeverity(config.diagnostics, diagnostic.type);
		if (severity !== "ignore") {
			const location = getDiagnosticLocation(config.context, dataProcessor, diagnostic);
			const message = getDiagnosticMessage(diagnostic);
			const color = diagnosticColors.get(severity) ?? (value => value);

			let text = `${color(severity)}: ${message}`;
			switch (location.type) {
				case "file":
					text += ` in ${formatFilename(location.filename)}`;
					break;

				case "fragment":
					text += ` in ${formatFilename(location.filename)}`;
					if (location.source) {
						const position = location.source.lineMap.getPosition(location.start);
						if (position !== null) {
							text += `:${position.line + 1}:${position.character + 1}`;
						}
					}
					break;
			}

			console.log(text);
		}

		if (severity === "error") {
			process.exitCode = 1;
		}
	}

	if (watch) {
		watchFiles({
			cwd: config.context,
			patterns: [
				config.translationData,
				...config.include,
			],

			async onChange(changes) {
				const updatedSources = new Map<string, Source>();
				const removedSources = new Set<string>();
				let translationData: TranslationData | undefined = undefined;

				for (const filename of changes.updated) {
					if (filename === config.translationData) {
						translationData = await TranslationData.read(config.translationData);
					} else {
						const source = await createSource(filename);
						const sourceId = Source.filenameToSourceId(config.context, filename);
						if (source === undefined) {
							emitDiagnostic({
								type: "unsupportedSource",
								sourceId,
							});
						} else {
							updatedSources.set(sourceId, source);
						}
					}
				}

				for (const filename of changes.removed) {
					if (filename !== config.translationData) {
						removedSources.add(Source.filenameToSourceId(config.context, filename));
					}
				}

				const result = dataProcessor.applyUpdate({
					updatedSources,
					removedSources,
					translationData,
				});

				if (modify) {
					if (dataProcessor.translationDataModified) {
						dataProcessor.translationDataModified = false;
						await TranslationData.write(config.translationData, dataProcessor.translationData);
					}

					for (const [sourceId, content] of result.modifiedSources) {
						await writeFile(Source.sourceIdToFilename(config.context, sourceId), content);
					}
				}

				if (output) {
					// TODO: Write output.
				}
			},
		});
	} else {
		const translationData = await TranslationData.read(config.translationData);

		const sources = new Map<string, Source>();
		for (const filename of await findFiles(config.context, config.include)) {
			const source = await createSource(filename);
			const sourceId = Source.filenameToSourceId(config.context, filename);
			if (source === undefined) {
				emitDiagnostic({
					type: "unsupportedSource",
					sourceId,
				});
			} else {
				sources.set(sourceId, source);
			}
		}

		const result = dataProcessor.applyUpdate({
			translationData,
			updatedSources: sources,
		});

		if (modify) {
			if (dataProcessor.translationDataModified) {
				dataProcessor.translationDataModified = false;
				await TranslationData.write(config.translationData, dataProcessor.translationData);
			}

			for (const [sourceId, content] of result.modifiedSources) {
				await writeFile(Source.sourceIdToFilename(config.context, sourceId), content);
			}
		} else if (dataProcessor.translationDataModified || result.modifiedSources.size > 0) {
			emitDiagnostic({
				type: "projectOutOfSync",
			});
		}

		if (output) {
			// TODO: Write output.
		}
	}
})().catch(error => {
	console.error(error);
	process.exit(1);
});
