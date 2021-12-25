#!/usr/bin/env node
import colors from "ansi-colors";
import { relative, resolve } from "path";
import parseArgv from "yargs-parser";

import { Config } from "./config.js";
import { getDiagnosticLocation } from "./diagnostics/location.js";
import { getDiagnosticMessage } from "./diagnostics/messages.js";
import { DiagnosticSeverity, getDiagnosticSeverity } from "./diagnostics/severity.js";
import { Project } from "./project.js";

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

	const project = await Project.create({
		config,
		fileSystem: undefined!, // TODO: Implement file system.
		onDiagnostic: (diagnostic, project) => {
			function formatFilename(filename: string) {
				return relative(process.cwd(), filename);
			}

			const severity = getDiagnosticSeverity(config.diagnostics, diagnostic.type);
			if (severity !== "ignore") {
				const location = getDiagnosticLocation(config.context, project.dataProcessor, diagnostic);
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
		},
	});

	if (watch) {
		project.watch({
			output,
			modify,
			onError: console.error,
		});
	} else {
		await project.run({
			output,
			modify,
		});
	}
})().catch(error => {
	console.error(error);
	process.exit(1);
});
