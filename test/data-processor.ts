import test from "ava";

import { DataAdapter } from "../src/data-adapter.js";
import { DataProcessor } from "../src/data-processor.js";
import { LocaleData } from "../src/runtime/locale-data.js";
import { clearModified, createInertAdapter, exportDataJson, fragment, importDataJson, verifyFragments } from "./_utility/data-adapter.js";
import { TestSource } from "./_utility/test-source.js";
import { unindent } from "./_utility/unindent.js";

test(`${DataProcessor.prototype.applyUpdate.name} (empty update)`, async t => {
	const dataProcessor = new DataProcessor({
		dataAdapter: createInertAdapter({}),
	});
	const result = dataProcessor.applyUpdate({});
	t.is(result.modifiedSources.size, 0);
	t.false(dataProcessor.dataAdapter.modified);
});

test(`${DataProcessor.prototype.applyUpdate.name} (state in sync)`, t => {
	const processor = new DataProcessor({
		dataAdapter: createInertAdapter({
			fragments: {
				0: fragment({ sourceId: "a", value: "foo" }),
				1: fragment({ sourceId: "a", value: "bar" }),
				2: fragment({ sourceId: "b", value: "baz" }),
			},
		}),
	});
	const result = processor.applyUpdate({
		updatedSources: new Map([
			["a", new TestSource(`
				foo id=0
				bar id=1
			`)],
			["b", new TestSource(`
				baz id=2
			`)],
		]),
	});
	t.false(processor.dataAdapter.modified);
	t.is(result.modifiedSources.size, 0);
});

for (const [name, adapter, ...updates] of ([
	[
		"missing id",
		createInertAdapter({
			fragments: {
				0: fragment({ sourceId: "b", value: "baz" }),
			},
		}),
		{
			updatedSources: new Map([
				["a", new TestSource(`
					foo id=42
					bar
				`)],
				["b", new TestSource(`
					baz id=0
				`)],
			]),
		},
	],
	[
		"duplicate id, no data",
		createInertAdapter({}),
		{
			updatedSources: new Map([
				["a", new TestSource(`
					foo id=0
					bar id=0
				`)],
			]),
		},
	],
	[
		"removed source",
		createInertAdapter({}),
		{
			updatedSources: new Map([
				["a", new TestSource(`
					foo id=0
				`)],
			]),
		},
		{
			removedSources: new Set(["a"]),
		},
	],
	[
		"missing source",
		createInertAdapter({
			fragments: {
				0: fragment({}),
			},
		}),
		{},
	],
	[
		"data update, add source",
		createInertAdapter({
			fragments: {
				1: fragment({
					value: "bar",
				}),
			},
		}),
		{
			updatedSources: new Map([
				["b", new TestSource(`
					bar id=1
				`)],
			]),
		},
	],
] as [string, DataAdapter, ...DataProcessor.Update[]][])) {
	test(`${DataProcessor.prototype.applyUpdate.name} (modify disabled, ${name})`, async t => {
		const processor = new DataProcessor({
			dataAdapter: adapter,
		});
		for (let i = 0; i < updates.length; i++) {
			const result = processor.applyUpdate({
				...updates[i],
				modify: false,
			});
			t.false(processor.dataAdapter.modified);
			t.is(result.modifiedSources.size, 0);
		}
	});
}

test(`${DataProcessor.prototype.applyUpdate.name} (missing id)`, async t => {
	const processor = new DataProcessor({
		dataAdapter: createInertAdapter({
			fragments: {
				0: fragment({ sourceId: "b", value: "baz" }),
			},
		}),
	});
	const result = processor.applyUpdate({
		updatedSources: new Map([
			["a", new TestSource(`
				foo id=42
				bar
			`)],
			["b", new TestSource(`
				baz id=0
			`)],
		]),
	});
	t.true(processor.dataAdapter.modified);
	verifyFragments(t, exportDataJson(processor.dataAdapter), {
		0: { sourceId: "b", value: "baz" },
		1: { sourceId: "a", value: "bar" },
		42: { sourceId: "a", value: "foo" },
	});
	t.deepEqual(result.modifiedSources, new Map([
		["a", unindent(`
			foo id=42
			bar id=1
		`)],
	]));
});

test(`${DataProcessor.prototype.applyUpdate.name} (duplicate id, multiple sources, no data)`, async t => {
	const processor = new DataProcessor({
		dataAdapter: createInertAdapter({

		}),
	});
	const result = processor.applyUpdate({
		updatedSources: new Map([
			["a", new TestSource(`
				foo id=0
			`)],
			["b", new TestSource(`
				bar id=0
			`)],
		]),
	});

	t.true(processor.dataAdapter.modified);
	verifyFragments(t, exportDataJson(processor.dataAdapter), {
		1: { sourceId: "a", value: "foo" },
		2: { sourceId: "b", value: "bar" },
	});

	t.deepEqual(result.modifiedSources, new Map([
		["a", unindent(`
			foo id=1
		`)],
		["b", unindent(`
			bar id=2
		`)],
	]));
});

test(`${DataProcessor.prototype.applyUpdate.name} (duplicate id, single source, no data)`, async t => {
	const processor = new DataProcessor({
		dataAdapter: createInertAdapter({}),
	});
	const result = processor.applyUpdate({
		updatedSources: new Map([
			["a", new TestSource(`
				foo id=0
				bar id=0
			`)],
		]),
	});

	t.true(processor.dataAdapter.modified);
	verifyFragments(t, exportDataJson(processor.dataAdapter), {
		0: { sourceId: "a", value: "foo" },
		1: { sourceId: "a", value: "bar" },
	});

	t.deepEqual(result.modifiedSources, new Map([
		["a", unindent(`
			foo id=0
			bar id=1
		`)],
	]));
});

test(`${DataProcessor.prototype.applyUpdate.name} (duplicate id, multiple sources, data in sync)`, async t => {
	const processor = new DataProcessor({
		dataAdapter: createInertAdapter({
			fragments: {
				0: fragment({ sourceId: "b", value: "bar" }),
			},
		}),
	});
	const result = processor.applyUpdate({
		updatedSources: new Map([
			["a", new TestSource(`
				foo id=0
			`)],
			["b", new TestSource(`
				bar id=0
			`)],
		]),
	});

	t.true(processor.dataAdapter.modified);
	verifyFragments(t, exportDataJson(processor.dataAdapter), {
		0: { sourceId: "b", value: "bar" },
		1: { sourceId: "a", value: "foo" },
	});

	t.deepEqual(result.modifiedSources, new Map([
		["a", unindent(`
			foo id=1
		`)],
	]));
});

test(`${DataProcessor.prototype.applyUpdate.name} (duplicate id, single source, data in sync)`, async t => {
	const processor = new DataProcessor({
		dataAdapter: createInertAdapter({
			fragments: {
				0: fragment({ sourceId: "b", value: "bar" }),
			},
		}),
	});
	const result = processor.applyUpdate({
		updatedSources: new Map([
			["a", new TestSource(`
				foo id=0
				bar id=0
			`)],
		]),
	});

	t.true(processor.dataAdapter.modified);
	verifyFragments(t, exportDataJson(processor.dataAdapter), {
		0: { sourceId: "a", value: "foo" },
		1: { sourceId: "a", value: "bar" },
	});

	t.deepEqual(result.modifiedSources, new Map([
		["a", unindent(`
			foo id=0
			bar id=1
		`)],
	]));
});

test(`${DataProcessor.prototype.applyUpdate.name} (duplicate id, multiple sources, data out of sync)`, async t => {
	const processor = new DataProcessor({
		dataAdapter: createInertAdapter({
			fragments: {
				0: fragment({ sourceId: "a", value: "baz" }),
			},
		}),
	});
	const result = processor.applyUpdate({
		updatedSources: new Map([
			["a", new TestSource(`
				foo id=0
			`)],
			["b", new TestSource(`
				bar id=0
			`)],
		]),
	});

	t.true(processor.dataAdapter.modified);
	verifyFragments(t, exportDataJson(processor.dataAdapter), {
		1: { sourceId: "a", value: "foo" },
		2: { sourceId: "b", value: "bar" },
	});

	t.deepEqual(result.modifiedSources, new Map([
		["a", unindent(`
			foo id=1
		`)],
		["b", unindent(`
			bar id=2
		`)],
	]));
});

test(`${DataProcessor.prototype.applyUpdate.name} (duplicate id, single source, data out of sync)`, async t => {
	const processor = new DataProcessor({
		dataAdapter: createInertAdapter({
			fragments: {
				0: fragment({ sourceId: "a", value: "baz" }),
			},
		}),
	});
	const result = processor.applyUpdate({
		updatedSources: new Map([
			["a", new TestSource(`
				foo id=0
				bar id=0
			`)],
		]),
	});

	t.true(processor.dataAdapter.modified);
	verifyFragments(t, exportDataJson(processor.dataAdapter), {
		0: { sourceId: "a", value: "foo" },
		1: { sourceId: "a", value: "bar" },
	});

	t.deepEqual(result.modifiedSources, new Map([
		["a", unindent(`
			foo id=0
			bar id=1
		`)],
	]));
});

test(`${DataProcessor.prototype.applyUpdate.name} (remove source)`, t => {
	const processor = new DataProcessor({
		dataAdapter: createInertAdapter({}),
	});

	processor.applyUpdate({
		updatedSources: new Map([
			["a", new TestSource(`
				foo id=0
			`)],
		]),
	});
	verifyFragments(t, exportDataJson(processor.dataAdapter), {
		0: { sourceId: "a", value: "foo" },
	});
	clearModified(processor.dataAdapter);

	const result = processor.applyUpdate({
		removedSources: new Set(["a"]),
	});
	t.is(result.modifiedSources.size, 0);

	t.true(processor.dataAdapter.modified);
	verifyFragments(t, exportDataJson(processor.dataAdapter), {});
});

test(`${DataProcessor.prototype.applyUpdate.name} (missing source)`, t => {
	const processor = new DataProcessor({
		dataAdapter: createInertAdapter({
			fragments: {
				0: fragment({}),
			},
		}),
	});
	const result = processor.applyUpdate({});
	t.is(result.modifiedSources.size, 0);
	t.true(processor.dataAdapter.modified);
	verifyFragments(t, exportDataJson(processor.dataAdapter), {});
});

test(`${DataProcessor.prototype.applyUpdate.name} (data update, add source)`, async t => {
	const processor = new DataProcessor({
		dataAdapter: createInertAdapter({}),
	});
	{
		const result = processor.applyUpdate({
			updatedSources: new Map([
				["a", new TestSource(`
					foo id=0
				`)],
			]),
		});
		t.is(result.modifiedSources.size, 0);
		t.true(processor.dataAdapter.modified);
		clearModified(processor.dataAdapter);
		verifyFragments(t, exportDataJson(processor.dataAdapter), {
			0: { sourceId: "a", value: "foo" },
		});
	}
	{
		importDataJson(processor.dataAdapter, {
			fragments: {
				1: fragment({
					value: "bar",
				}),
			},
		});
		const result = processor.applyUpdate({
			updatedSources: new Map([
				["b", new TestSource(`
					bar id=1
				`)],
			]),
		});
		t.is(result.modifiedSources.size, 0);
		t.true(processor.dataAdapter.modified);
		verifyFragments(t, exportDataJson(processor.dataAdapter), {
			0: { sourceId: "a", value: "foo" },
			1: { sourceId: "b", value: "bar" },
		});
	}
});

test(`${DataProcessor.prototype.applyUpdate.name} (data update, update source)`, async t => {
	const processor = new DataProcessor({
		dataAdapter: createInertAdapter({}),
	});
	{
		const result = processor.applyUpdate({
			updatedSources: new Map([
				["a", new TestSource(`
					foo id=0
				`)],
			]),
		});
		t.is(result.modifiedSources.size, 0);
		t.true(processor.dataAdapter.modified);
		clearModified(processor.dataAdapter);
	}
	{
		importDataJson(processor.dataAdapter, {
			fragments: {},
		});
		const result = processor.applyUpdate({
			updatedSources: new Map([
				["a", new TestSource(`
					bar id=0
				`)],
			]),
		});
		t.is(result.modifiedSources.size, 0);
		t.true(processor.dataAdapter.modified);
		verifyFragments(t, exportDataJson(processor.dataAdapter), {
			0: { sourceId: "a", value: "bar" },
		});
	}
});

test(`${DataProcessor.prototype.applyUpdate.name} (data update, removed source)`, async t => {
	const processor = new DataProcessor({
		dataAdapter: createInertAdapter({}),
	});
	{
		const result = processor.applyUpdate({
			updatedSources: new Map([
				["a", new TestSource(`
					foo id=0
				`)],
			]),
		});
		t.is(result.modifiedSources.size, 0);
		t.true(processor.dataAdapter.modified);
		clearModified(processor.dataAdapter);
	}
	{
		importDataJson(processor.dataAdapter, {
			fragments: {
				0: fragment({
					value: "foo",
				}),
			},
		});
		const result = processor.applyUpdate({
			removedSources: new Set(["a"]),
		});
		t.is(result.modifiedSources.size, 0);
		t.true(processor.dataAdapter.modified);
		verifyFragments(t, exportDataJson(processor.dataAdapter), {});
	}
});

test(`${DataProcessor.prototype.getFragmentDiagnostics.name} (empty)`, t => {
	const processor = new DataProcessor({
		dataAdapter: createInertAdapter({}),
	});
	t.deepEqual(processor.getFragmentDiagnostics({
		sourceLocale: "en",
		translatedLocales: ["de", "zh"],
	}), []);
});

test(`${DataProcessor.prototype.getFragmentDiagnostics.name} (missing translations)`, t => {
	const modified = new Date().toISOString();
	const processor = new DataProcessor({
		dataAdapter: createInertAdapter({
			fragments: {
				0: fragment({
					value: "foo",
					modified: modified,
				}),
				1: fragment({
					value: "bar",
					modified: modified,
					translations: {
						de: { value: "test", modified },
					},
				}),
				2: fragment({
					value: "baz",
					modified: modified,
					translations: {
						de: { value: "test", modified },
						zh: { value: "test", modified },
					},
				}),
			},
		}),
	});
	processor.applyUpdate({
		updatedSources: new Map([
			["test", new TestSource(`
				foo id=0
				bar id=1
				baz id=2
			`)],
		]),
	});
	t.deepEqual(processor.getFragmentDiagnostics({
		sourceLocale: "en",
		translatedLocales: ["de", "zh"],
	}), [
		{
			type: "missingTranslations",
			sourceId: "test",
			fragmentId: "0",
			locales: ["de", "zh"],
		},
		{
			type: "missingTranslations",
			sourceId: "test",
			fragmentId: "1",
			locales: ["zh"],
		},
	]);
});

test(`${DataProcessor.prototype.getFragmentDiagnostics.name} (unknown translations)`, t => {
	const modified = new Date().toISOString();
	const processor = new DataProcessor({
		dataAdapter: createInertAdapter({
			fragments: {
				0: fragment({
					value: "foo",
					modified,
					translations: {
						de: { value: "test", modified },
						zh: { value: "test", modified },
					},
				}),
				1: fragment({
					value: "bar",
					modified,
					translations: {
						de: { value: "test", modified },
					},
				}),
			},
		}),
	});
	processor.applyUpdate({
		updatedSources: new Map([
			["test", new TestSource(`
				foo id=0
				bar id=1
			`)],
		]),
	});
	t.deepEqual(processor.getFragmentDiagnostics({
		sourceLocale: "en",
		translatedLocales: ["de"],
	}), [
		{
			type: "unknownTranslations",
			sourceId: "test",
			fragmentId: "0",
			locales: ["zh"],
		},
	]);
});

test(`${DataProcessor.prototype.getFragmentDiagnostics.name} (outdated translations)`, t => {
	const modified = new Date().toISOString();
	const processor = new DataProcessor({
		dataAdapter: createInertAdapter({
			fragments: {
				0: fragment({
					value: "foo",
					modified,
					translations: {
						de: { value: "test", modified },
						zh: { value: "test", modified: new Date(Date.parse(modified) - 1000).toISOString() },
					},
				}),
				1: fragment({
					value: "bar",
					modified,
					translations: {
						de: { value: "test", modified },
						zh: { value: "test", modified },
					},
				}),
			},
		}),
	});
	processor.applyUpdate({
		updatedSources: new Map([
			["test", new TestSource(`
				foo id=0
				bar id=1
			`)],
		]),
	});
	t.deepEqual(processor.getFragmentDiagnostics({
		sourceLocale: "en",
		translatedLocales: ["de", "zh"],
	}), [
		{
			type: "outdatedTranslations",
			sourceId: "test",
			fragmentId: "0",
			locales: ["zh"],
		},
	]);
});

test(`${DataProcessor.prototype.getFragmentDiagnostics.name} (unmanaged duplicate fragment)`, t => {
	const modified = new Date().toISOString();
	const processor = new DataProcessor({
		dataAdapter: createInertAdapter({
			fragments: {
				1: fragment({
					value: "baz",
					sourceId: "b",
					modified,
					translations: {
						en: { value: "test", modified },
					},
				}),
			},
		}),
	});
	processor.applyUpdate({
		updatedSources: new Map([
			["a", new TestSource(`
				foo id=0
			`, false)],
			["b", new TestSource(`
				bar id=0
				baz id=1
			`, false)],
		]),
	});
	t.false(processor.dataAdapter.modified);
	t.deepEqual(processor.getFragmentDiagnostics({
		sourceLocale: "en",
		translatedLocales: ["en"],
	}), [
		{
			type: "duplicateFragment",
			sourceIds: ["a", "b"],
			fragmentId: "0",
		},
	]);
});

test(`${DataProcessor.prototype.getFragmentDiagnostics.name} (value type mismatch)`, t => {
	const modified = new Date().toISOString();
	const processor = new DataProcessor({
		dataAdapter: createInertAdapter({
			fragments: {
				0: fragment({
					value: "foo",
					modified,
					translations: {
						de: { value: {
							type: "plural",
							value: ["foo", "bar"],
						}, modified },
					},
				}),
			},
		}),
	});
	processor.applyUpdate({
		updatedSources: new Map([
			["test", new TestSource(`
				foo id=0
			`)],
		]),
	});
	t.deepEqual(processor.getFragmentDiagnostics({
		sourceLocale: "en",
		translatedLocales: ["de"],
	}), [
		{
			type: "valueTypeMismatch",
			sourceId: "test",
			fragmentId: "0",
			locales: ["de"],
		},
	]);
});

test(`${DataProcessor.prototype.getFragmentDiagnostics.name} (plural form count mismatch)`, t => {
	const modified = new Date().toISOString();
	const processor = new DataProcessor({
		dataAdapter: createInertAdapter({
			fragments: {
				0: fragment({
					value: {
						type: "plural",
						value: ["foo", "bar", "baz"],
					},
					modified,
					translations: {
						de: { value: {
							type: "plural",
							value: ["foo"],
						}, modified },
					},
				}),
			},
		}),
	});
	processor.applyUpdate({
		updatedSources: new Map([
			["test", new TestSource(`
				plural: foo bar baz id=0
			`)],
		]),
	});
	t.deepEqual(processor.getFragmentDiagnostics({
		sourceLocale: "en",
		translatedLocales: ["de"],
	}), [
		{
			type: "pluralFormCountMismatch",
			sourceId: "test",
			fragmentId: "0",
			locale: "en",
			actualFormCount: 3,
			expectedFormCount: 2,
		},
		{
			type: "pluralFormCountMismatch",
			sourceId: "test",
			fragmentId: "0",
			locale: "de",
			actualFormCount: 1,
			expectedFormCount: 2,
		},
	]);
});

test(`${DataProcessor.prototype.getFragmentDiagnostics.name} (unsupported locales)`, t => {
	const modified = new Date().toISOString();
	const processor = new DataProcessor({
		dataAdapter: createInertAdapter({
			fragments: {
				0: fragment({
					value: "foo",
					modified,
					translations: {
						bar: { value: "foo", modified },
						baz: { value: "bar", modified },
					},
				}),
			},
		}),
	});
	processor.applyUpdate({
		updatedSources: new Map([
			["test", new TestSource(`
				foo id=0
			`)],
		]),
		modify: false,
	});
	t.deepEqual(processor.getFragmentDiagnostics({
		sourceLocale: "foo",
		translatedLocales: ["bar"],
	}), [
		{
			type: "unknownTranslations",
			sourceId: "test",
			fragmentId: "0",
			locales: ["baz"],
		},
		{
			type: "unsupportedLocales",
			locales: [
				"bar",
				"baz",
				"foo",
			],
		},
	]);
});

test(`${DataProcessor.prototype.generateLocaleData.name}, ${DataProcessor.prototype.generateManifest.name}`, t => {
	const modified = new Date().toISOString();
	const processor = new DataProcessor({
		dataAdapter: createInertAdapter({
			fragments: {
				0: fragment({
					value: "foo",
					sourceId: "a",
					modified,
					translations: {
						en: { value: "test", modified },
					},
				}),
				1: fragment({
					value: "bar",
					sourceId: "a",
					modified,
					translations: {
						en: { value: "test", modified: new Date(Date.parse(modified) - 1000).toISOString() },
					},
				}),
				2: fragment({
					value: "boo",
					sourceId: "a",
					modified,
					translations: {
						en: { value: "test", modified },
					},
				}),
				3: fragment({
					value: "test",
					sourceId: "a",
					modified,
					translations: {
						en: { value: { type: "plural", value: ["a", "b"] }, modified },
					},
				}),
				4: fragment({
					sourceId: "a",
					modified,
					translations: {
						en: { value: "test", modified },
					},
				}),
				5: fragment({
					sourceId: "a",
					modified,
					enabled: false,
					translations: {
						en: { value: "test", modified },
					},
				}),
			},
		}),
	});

	processor.applyUpdate({
		updatedSources: new Map([
			["a", new TestSource(`
				foo id=0
				bar id=1
				baz id=2
				test id=3
				# test id=5
			`).withOutputFilenames(["/test/dist/a.js"])],
			["b1", new TestSource(`
				unlocalized id=7
			`).withOutputFilenames(["/test/dist/b.js"])],
			["b2", new TestSource(`
				unlocalized id=8
			`).withOutputFilenames(["/test/dist/b.js"])],
			["c", new TestSource(`
				global id=9
			`)],
		]),
		modify: false,
	});

	t.deepEqual(processor.generateLocaleData({
		namespace: "test",
		includeOutdated: false,
		sourceLocale: "de",
		translatedLocales: ["en", "zh"],
	}), new Map<string, LocaleData>([
		["de", {}],
		["en", {
			test: {
				0: "test",
			},
		}],
		["zh", {}],
	]));

	t.deepEqual(processor.generateLocaleData({
		namespace: "test",
		includeOutdated: true,
		sourceLocale: "de",
		translatedLocales: ["en", "zh"],
	}), new Map<string, LocaleData>([
		["de", {}],
		["en", {
			test: {
				0: "test",
				1: "test",
			},
		}],
		["zh", {}],
	]));

	t.deepEqual(processor.generateManifest({
		namespace: "test",
		localeDataFilenames: new Map([
			["en", "/test/dist/en.json"],
			["de", "/test/dist/hashed/de.1234.json"],
		]),
		manifestFilename: "/test/dist/manifest.json",
	}), {
		version: 2,
		locales: {
			en: "en.json",
			de: "hashed/de.1234.json",
		},
		files: {
			"": {
				namespaces: {
					test: {
						fragmentIds: ["9"],
					},
				},
			},
			"a.js": {
				namespaces: {
					test: {
						fragmentIds: ["0", "1", "2", "3", "5"],
					},
				},
			},
			"b.js": {
				namespaces: {
					test: {
						fragmentIds: ["7", "8"],
					},
				},
			},
		},
	});
});
