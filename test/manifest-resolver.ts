import { join } from "node:path";

import test from "ava";

import { Manifest } from "../src/manifest.js";
import { ManifestResolver } from "../src/manifest-resolver.js";
import { createFsLayout } from "./_utility/temp-dir.js";

function createManifest(): Manifest {
	return {
		version: 1,
		files: {},
		locales: {},
	};
}

test("resolution", async t => {
	const cwd = await createFsLayout(__filename, t, {
		[Manifest.NAME]: Manifest.stringify(createManifest()),
		foo: {
			bar: {
				[Manifest.NAME]: Manifest.stringify(createManifest()),
			},
		},
	});

	const resolver = new ManifestResolver();

	for (const [targetDirname, expectedContext] of [
		["..", null],
		["", ""],
		["foo", ""],
		["bar", ""],
		["foo/bar", "foo/bar"],
		["foo/bar/baz", "foo/bar"],
	] as [string, string | null][]) {
		const result = await resolver.resolve(join(cwd, targetDirname, "test.js"));
		if (expectedContext === null) {
			t.true(result === null || !result.context.startsWith(cwd), `unexpected result for ${JSON.stringify(targetDirname)}`);
		} else {
			t.true(result !== null, `no result for ${JSON.stringify(targetDirname)}`);
			t.is(result!.context, join(cwd, expectedContext));
		}
	}
});
