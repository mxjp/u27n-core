import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import test from "ava";

import { Config } from "../src/config.js";
import { DataJson } from "../src/data-adapter-default.js";
import { Diagnostic, getDiagnosticMessage } from "../src/diagnostics.js";
import { Manifest } from "../src/manifest.js";
import { LocaleData } from "../src/runtime/index.js";
import { fragment, translationData } from "./_utility/data-adapter.js";
import { exec, execStart } from "./_utility/exec.js";
import { jsonFile } from "./_utility/json-file.js";
import { createFsLayout } from "./_utility/temp-dir.js";
import { unindent } from "./_utility/unindent.js";
import { wait } from "./_utility/wait.js";

const cliBin = join(__dirname, "../src/cli.js");

const cliConfig = ["--config", "u27n.json"];

function cliArgs(...args: string[]): [string, string[]] {
	return ["node", [cliBin, ...args]];
}

function configFile(overwrite?: Partial<Config.Json>): Record<string, string> {
	return {
		"u27n.json": jsonFile<Config.Json>({
			namespace: "test",
			include: [
				"./src/**/*.txt",
			],
			locales: [
				"en",
				"de",
			],
			plugins: [
				"../../test_out/test/_utility/test-plugin",
			],
			output: {
				filename: "./locale/[locale].json",
				includeOutdated: false,
				manifestPath: ".",
				...overwrite?.output,
			},
			...overwrite,
		}),
	};
}

function translationDataFile(data: Partial<DataJson>): Record<string, string> {
	return {
		"u27n-data.json": JSON.stringify(translationData(data), null, "\t") + "\n",
	};
}

async function readTranslationData(cwd: string, path = "u27n-data.json"): Promise<DataJson> {
	return JSON.parse(await readFile(join(cwd, path), "utf-8")) as DataJson;
}

async function readLocaleData(cwd: string, path = "locale"): Promise<Map<string, LocaleData>> {
	const dirname = resolve(cwd, path);
	const data = new Map<string, LocaleData>();
	for (const name of await (await readdir(dirname)).sort()) {
		const match = /^(.*)\.json$/.exec(name);
		if (match) {
			data.set(match[1], JSON.parse(await readFile(join(dirname, name), "utf-8")) as LocaleData);
		}
	}
	return data;
}

async function readManifest(cwd: string, path = "."): Promise<Manifest> {
	return Manifest.parse(await readFile(join(cwd, path, Manifest.NAME), "utf-8"));
}

function hasDiagnostic(output: string, diagnostic: Diagnostic): boolean {
	return output.includes(getDiagnosticMessage(diagnostic));
}

test("empty project, no translation data", async t => {
	const cwd = await createFsLayout(__filename, t, {
		...configFile(),
		src: {},
	});
	await exec(t, cwd, ...cliArgs(...cliConfig));
	t.deepEqual(await readLocaleData(cwd), new Map([
		["de", {}],
		["en", {}],
	]));
});

test("sync project", async t => {
	const modified = new Date().toISOString();
	const cwd = await createFsLayout(__filename, t, {
		...configFile(),
		...translationDataFile({
			fragments: {
				0: fragment({
					value: "foo",
					sourceId: "src/foo.txt",
					modified,
					translations: {
						de: { value: "bar", modified },
					},
				}),
			},
		}),
		src: {
			"foo.txt": unindent(`
				foo id=0
			`),
			"something-else.json": unindent(`{}`),
		},
	});
	await exec(t, cwd, ...cliArgs(...cliConfig));
	t.deepEqual(await readLocaleData(cwd), new Map<string, LocaleData>([
		["de", {
			test: {
				0: "bar",
			},
		}],
		["en", {}],
	]));

	t.deepEqual(await readManifest(cwd), {
		version: 2,
		locales: {
			en: "locale/en.json",
			de: "locale/de.json",
		},
		files: {
			"src/foo.txt.out": {
				namespaces: {
					test: {
						fragmentIds: ["0"],
					},
				},
			},
		},
	});
});

test("out of sync project", async t => {
	const cwd = await createFsLayout(__filename, t, {
		...configFile(),
		...translationDataFile({}),
		src: {
			"foo.txt": unindent(`
				foo id=0
			`),
			"something-else.json": unindent(`{}`),
		},
	});

	const { output } = await exec(t, cwd, ...cliArgs(...cliConfig), {
		expectStatus: 1,
	});

	t.true(hasDiagnostic(output, {
		type: "projectOutOfSync",
	}));
	t.true(hasDiagnostic(output, {
		type: "missingTranslations",
		sourceId: "src/foo.txt",
		fragmentId: "0",
		locales: ["de"],
	}));

	t.deepEqual(await readLocaleData(cwd), new Map([
		["de", {}],
		["en", {}],
	]));

	t.deepEqual(await readManifest(cwd), {
		version: 2,
		locales: {
			en: "locale/en.json",
			de: "locale/de.json",
		},
		files: {
			"src/foo.txt.out": {
				namespaces: {
					test: {
						fragmentIds: ["0"],
					},
				},
			},
		},
	});
});

test("watch project", async t => {
	const cwd = await createFsLayout(__filename, t, {
		...configFile(),
		src: {},
	});
	const cli = await execStart(t, cwd, ...cliArgs(...cliConfig, "--watch"));
	try {
		await writeFile(join(cwd, "src/test.txt"), unindent(`
			foo id=0
		`));
		await wait(async () => {
			const data = await readTranslationData(cwd);
			if ("0" in data.fragments) {
				return data;
			}
		})!;
		await writeFile(join(cwd, "src/test2.txt"), unindent(`
			bar id=0
		`));
		await wait(async () => {
			const data = await readTranslationData(cwd);
			if ("1" in data.fragments) {
				return data;
			}
		})!;
		t.pass();
	} finally {
		await cli.kill();
	}
});
