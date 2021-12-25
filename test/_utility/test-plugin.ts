import { Plugin, PluginSetupContext } from "../../src/index.js";
import { ManagedTestSource } from "./managed-test-source.js";

export class TestPlugin implements Plugin {
	public async setup(_setupContext: PluginSetupContext, _config: TestPlugin.Config): Promise<void> {
	}

	public createSource(filename: string, content: string): ManagedTestSource | undefined {
		if (/\.txt$/.test(filename)) {
			return new ManagedTestSource(content);
		}
	}
}

export default TestPlugin;

export declare namespace TestPlugin {
	export interface Config {
	}
}
