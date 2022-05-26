import { Plugin, PluginSetupContext } from "../../src/index.js";
import { TestSource } from "./test-source.js";

export class TestPlugin implements Plugin {
	public async setup(_setupContext: PluginSetupContext, _config: TestPlugin.Config): Promise<void> {
	}

	public createSource(filename: string, content: string): TestSource | undefined {
		if (/\.txt$/.test(filename)) {
			return new TestSource(content).withOutputFilenames([
				filename + ".out",
			]);
		}
	}
}

export default TestPlugin;

export declare namespace TestPlugin {
	export interface Config {
	}
}
