import { Plugin, PluginContext } from "../../src/index.js";
import { ManagedTestSource } from "./managed-test-source.js";

export class TestPlugin implements Plugin {
	public async setup(_context: PluginContext, _config: TestPlugin.Config): Promise<void> {
	}

	public createSource(filename: string, content: string): ManagedTestSource | undefined {
		if (/\.txt$/.test(filename)) {
			return new ManagedTestSource(content);
		}
	}
}

export declare namespace TestPlugin {
	export interface Config {
	}
}
