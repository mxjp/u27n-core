import test from "ava";
import { join } from "path";

import { Config } from "../src/config.js";
import { exec } from "./_utility/exec.js";
import { jsonFile } from "./_utility/json-file.js";
import { createFsLayout } from "./_utility/temp-dir.js";

const cliBin = join(__dirname, "../src/cli.js");

test("foo", async t => {
	const cwd = await createFsLayout(__filename, t, {
		"u27n.json": jsonFile<Config.Json>({
			namespace: "test",
			locales: [
				"en",
				"de",
			],
			plugins: [
				"../../test_out/test/_utility/test-plugin",
			],
		}),
		"src": {
			"test.txt": `test 42`,
		},
	});

	await exec(cwd, "node", [cliBin, "--config", "u27n.json"]);

	t.pass();
});
