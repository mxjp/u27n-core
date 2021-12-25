#!/usr/bin/env node
import { readFile, writeFile } from "fs/promises";
import { resolve } from "path";
import parseArgv from "yargs-parser";

import { Config } from "./config.js";
import { Plugin, PluginContext, PluginModule } from "./plugin.js";
import { Project } from "./project.js";
import { Source } from "./source.js";
import { TranslationData } from "./translation-data.js";
import { findFiles, watchFiles } from "./utility/file-system.js";

interface Args extends parseArgv.Arguments {
	config?: string;
	watch?: boolean;
	output?: boolean;
	modify?: boolean;
}

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

	const pluginContext: PluginContext = {
		config,
	};

	const plugins: Plugin[] = [];
	for (const pluginConfig of config.plugins) {
		const module = await import(pluginConfig.entry) as PluginModule;
		const plugin = typeof module.default === "function" ? new module.default() : module.default;
		await plugin.setup?.(pluginContext, pluginConfig.config);
		plugins.push(plugin);
	}

	async function createSource(filename: string): Promise<Source | undefined> {
		const content = await readFile(filename, "utf-8");
		for (const plugin of plugins) {
			const source = plugin.createSource?.(filename, content) as Source | undefined;
			if (source !== undefined) {
				return source;
			}
		}
	}

	const project = new Project(pluginContext);

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
						if (source === undefined) {
							// TODO: Emit diagnostic for unsupported source.
						} else {
							updatedSources.set(Source.filenameToSourceId(config.context, filename), source);
						}
					}
				}

				for (const filename of changes.removed) {
					if (filename !== config.translationData) {
						removedSources.add(Source.filenameToSourceId(config.context, filename));
					}
				}

				const result = project.applyUpdate({
					updatedSources,
					removedSources,
					translationData,
				});

				if (modify) {
					if (project.translationDataModified) {
						project.translationDataModified = false;
						await TranslationData.write(config.translationData, project.translationData);
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
			if (source === undefined) {
				// TODO: Emit diagnostic for unsupported source.
			} else {
				sources.set(Source.filenameToSourceId(config.context, filename), source);
			}
		}

		const result = project.applyUpdate({
			translationData,
			updatedSources: sources,
		});

		if (modify) {
			if (project.translationDataModified) {
				project.translationDataModified = false;
				await TranslationData.write(config.translationData, project.translationData);
			}

			for (const [sourceId, content] of result.modifiedSources) {
				await writeFile(Source.sourceIdToFilename(config.context, sourceId), content);
			}
		} else {
			if (project.translationDataModified) {
				// TODO: Emit diagnostic for out of sync translation data.
			}
			if (result.modifiedSources.size > 0) {
				// TODO: Emit diagnostic for out of sync sources.
			}
		}

		if (output) {
			// TODO: Write output.
		}
	}
})().catch(error => {
	console.error(error);
	process.exit(1);
});
