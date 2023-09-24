import { Plugin } from "../../src/index.js";
import { TestSource } from "./test-source.js";

export class TestPlugin implements Plugin {
	async createSource({ filename, getTextContent }: Plugin.CreateSourceContext): Promise<TestSource | undefined> {
		if (/\.txt$/.test(filename)) {
			return new TestSource(await getTextContent()).withOutputFilenames([
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
