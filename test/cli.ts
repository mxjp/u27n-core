import test from "ava";

import { Config } from "../src/config.js";
import { jsonFile } from "./_utility/json-file.js";
import { createFsLayout } from "./_utility/temp-dir.js";

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
	});

	console.log(cwd);

	t.pass();
});
