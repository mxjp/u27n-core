import { Plugin, PluginContext } from "../../src/index.js";

export class TestPlugin implements Plugin {
	public async setup(_context: PluginContext, _config: TestPlugin.Config): Promise<void> {
	}
}

export declare namespace TestPlugin {
	export interface Config {
	}
}
