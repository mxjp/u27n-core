#!/usr/bin/env node
import { resolve } from "path";

import { Config } from "./config.js";
import { Plugin, PluginContext, PluginModule } from "./plugin.js";
import { Project } from "./project.js";

(async () => {
	const configFilename = resolve("./example/config.json");
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

	const _project = new Project(pluginContext);

	// TODO: Production workflow:
	// - Find translation data.
	// - Find all sources.
	// - Apply project update.
	// - Write output.

	// TODO: Development workflow:
	// - Find and watch translation data.
	// - Find and watch sources.
	// - Apply initial project update.
	// - Write output.
	// - When changes are detected:
	//   - Apply update.
	//   - Write output.
})().catch(error => {
	console.error(error);
	process.exit(1);
});
