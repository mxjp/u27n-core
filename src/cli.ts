#!/usr/bin/env node
import colors from "ansi-colors";
import { relative, resolve } from "path";
import parseArgv from "yargs-parser";

import { Config } from "./config.js";
import { Diagnostic, DiagnosticSeverity, getDiagnosticLocations, getDiagnosticMessage, getDiagnosticSeverity } from "./diagnostics.js";
import { Project } from "./project.js";
import { NodeFileSystem } from "./utility/file-system-node.js";

interface Args extends parseArgv.Arguments {
	config?: string;
	watch?: boolean;
	output?: boolean;
	modify?: boolean;
	delay?: number;
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

	const delay = args.delay ?? 100;
	if (typeof delay !== "number" || !Number.isInteger(delay) || delay < 0 || delay > 10000) {
		throw new TypeError("--delay must be a number from 0 to 10000.");
	}

	const configFilename = resolve(args.config ?? "u27n.json");
	const config = await Config.read(configFilename);

	const project = await Project.create({
		config,
		fileSystem: new NodeFileSystem(),
	});

	function handleDiagnostic(diagnostic: Diagnostic) {
		function formatFilename(filename: string) {
			return relative(process.cwd(), filename);
		}

		const severity = getDiagnosticSeverity(config.diagnostics, diagnostic.type);
		if (severity !== "ignore") {
			const locations = getDiagnosticLocations(config.context, project.dataProcessor, diagnostic);
			const message = getDiagnosticMessage(diagnostic);
			const color = diagnosticColors.get(severity) ?? (value => value);

			let text = `${color(severity)}: ${message}`;

			for (const location of locations) {
				switch (location.type) {
					case "file":
						text += `\n  in ${formatFilename(location.filename)}`;
						break;

					case "fragment":
						text += `\n  in ${formatFilename(location.filename)}`;
						if (location.source) {
							const position = location.source.lineMap.getPosition(location.start);
							if (position !== null) {
								text += `:${position.line + 1}:${position.character + 1}`;
							}
						}
						break;
				}
			}

			console.log(text);
		}

		if (severity === "error") {
			process.exitCode = 1;
		}
	}

	if (watch) {
		project.watch({
			delay,
			output,
			modify,
			fragmentDiagnostics: true,
			onError: console.error,
			onDiagnostics: diagnostics => {
				diagnostics.forEach(handleDiagnostic);
			},
		});
	} else {
		const result = await project.run({
			output,
			modify,
			fragmentDiagnostics: true,
		});
		result.diagnostics.forEach(handleDiagnostic);
	}
})().catch(error => {
	console.error(error);
	process.exit(1);
});
