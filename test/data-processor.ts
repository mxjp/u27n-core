import test from "ava";

import { DataProcessor } from "../src/data-processor.js";
import { LocaleData } from "../src/runtime/locale-data.js";
import { TestSource } from "./_utility/test-source.js";
import { TranslationDataUtility as td } from "./_utility/translation-data.js";
import { unindent } from "./_utility/unindent.js";

test(`${DataProcessor.prototype.applyUpdate.name} (empty update)`, t => {
	const dataProcessor = new DataProcessor();
	const result = dataProcessor.applyUpdate({});
	t.is(result.modifiedSources.size, 0);
	t.false(dataProcessor.translationDataModified);
});

test(`${DataProcessor.prototype.applyUpdate.name} (state in sync)`, t => {
	const processor = new DataProcessor();
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
		translationData: td.translationData({
			fragments: {
				0: td.fragment({ sourceId: "a", value: "foo" }),
				1: td.fragment({ sourceId: "a", value: "bar" }),
				2: td.fragment({ sourceId: "b", value: "baz" }),
			},
		}),
	});
	t.false(processor.translationDataModified);
	t.is(result.modifiedSources.size, 0);
});

for (const [name, ...updates] of ([
	["missing id", {
		updatedSources: new Map([
			["a", new TestSource(`
				foo id=42
				bar
			`)],
			["b", new TestSource(`
				baz id=0
			`)],
		]),
		translationData: td.translationData({
			fragments: {
				0: td.fragment({ sourceId: "b", value: "baz" }),
			},
		}),
	}],
	["duplicate id, no data", {
		updatedSources: new Map([
			["a", new TestSource(`
				foo id=0
				bar id=0
			`)],
		]),
	}],
	["removed source", {
		updatedSources: new Map([
			["a", new TestSource(`
				foo id=0
			`)],
		]),
	}, {
		removedSources: new Set(["a"]),
	}],
	["missing source", {
		translationData: td.translationData({
			fragments: {
				0: td.fragment({}),
			},
		}),
	}],
	["data update, add source", {
		updatedSources: new Map([
			["a", new TestSource(`
				foo id=0
			`)],
		]),
	}, {
		translationData: td.translationData({
			fragments: {
				1: td.fragment({
					value: "bar",
				}),
			},
		}),
		updatedSources: new Map([
			["b", new TestSource(`
				bar id=1
			`)],
		]),
	}],
] as [string, ...DataProcessor.Update[]][])) {
	test(`${DataProcessor.prototype.applyUpdate.name} (modify disabled, ${name})`, async t => {
		const processor = new DataProcessor();

		for (let i = 0; i < updates.length; i++) {
			const result = processor.applyUpdate({
				...updates[i],
				modify: false,
			});
			t.false(processor.translationDataModified);
			t.is(result.modifiedSources.size, 0);
		}
	});
}

test(`${DataProcessor.prototype.applyUpdate.name} (missing id)`, async t => {
	const processor = new DataProcessor();
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
		translationData: td.translationData({
			fragments: {
				0: td.fragment({ sourceId: "b", value: "baz" }),
			},
		}),
	});
	t.true(processor.translationDataModified);
	td.verifyFragments(t, processor.translationData, {
		0: { sourceId: "b", value: "baz" },
		1: { sourceId: "a", value: "bar" },
		42: { sourceId: "a", value: "foo" },
	});
	processor.translationDataModified = false;
	t.false(processor.translationDataModified);

	t.deepEqual(result.modifiedSources, new Map([
		["a", unindent(`
			foo id=42
			bar id=1
		`)],
	]));
});

test(`${DataProcessor.prototype.applyUpdate.name} (duplicate id, multiple sources, no data)`, async t => {
	const processor = new DataProcessor();
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

	t.true(processor.translationDataModified);
	td.verifyFragments(t, processor.translationData, {
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
	const processor = new DataProcessor();
	const result = processor.applyUpdate({
		updatedSources: new Map([
			["a", new TestSource(`
				foo id=0
				bar id=0
			`)],
		]),
	});

	t.true(processor.translationDataModified);
	td.verifyFragments(t, processor.translationData, {
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
	const processor = new DataProcessor();
	const result = processor.applyUpdate({
		updatedSources: new Map([
			["a", new TestSource(`
				foo id=0
			`)],
			["b", new TestSource(`
				bar id=0
			`)],
		]),
		translationData: td.translationData({
			fragments: {
				0: td.fragment({ sourceId: "b", value: "bar" }),
			},
		}),
	});

	t.true(processor.translationDataModified);
	td.verifyFragments(t, processor.translationData, {
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
	const processor = new DataProcessor();
	const result = processor.applyUpdate({
		updatedSources: new Map([
			["a", new TestSource(`
				foo id=0
				bar id=0
			`)],
		]),
		translationData: td.translationData({
			fragments: {
				0: td.fragment({ sourceId: "b", value: "bar" }),
			},
		}),
	});

	t.true(processor.translationDataModified);
	td.verifyFragments(t, processor.translationData, {
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
	const processor = new DataProcessor();
	const result = processor.applyUpdate({
		updatedSources: new Map([
			["a", new TestSource(`
				foo id=0
			`)],
			["b", new TestSource(`
				bar id=0
			`)],
		]),
		translationData: td.translationData({
			fragments: {
				0: td.fragment({ sourceId: "a", value: "baz" }),
			},
		}),
	});

	t.true(processor.translationDataModified);
	td.verifyFragments(t, processor.translationData, {
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
	const processor = new DataProcessor();
	const result = processor.applyUpdate({
		updatedSources: new Map([
			["a", new TestSource(`
				foo id=0
				bar id=0
			`)],
		]),
		translationData: td.translationData({
			fragments: {
				0: td.fragment({ sourceId: "a", value: "baz" }),
			},
		}),
	});

	t.true(processor.translationDataModified);
	td.verifyFragments(t, processor.translationData, {
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
	const processor = new DataProcessor();

	processor.applyUpdate({
		updatedSources: new Map([
			["a", new TestSource(`
				foo id=0
			`)],
		]),
	});
	td.verifyFragments(t, processor.translationData, {
		0: { sourceId: "a", value: "foo" },
	});
	processor.translationDataModified = false;
	t.false(processor.translationDataModified);

	const result = processor.applyUpdate({
		removedSources: new Set(["a"]),
	});
	t.is(result.modifiedSources.size, 0);

	t.true(processor.translationDataModified);
	td.verifyFragments(t, processor.translationData, {});
});

test(`${DataProcessor.prototype.applyUpdate.name} (missing source)`, t => {
	const processor = new DataProcessor();
	const result = processor.applyUpdate({
		translationData: td.translationData({
			fragments: {
				0: td.fragment({}),
			},
		}),
	});
	t.is(result.modifiedSources.size, 0);
	t.true(processor.translationDataModified);
	td.verifyFragments(t, processor.translationData, {});
});

test(`${DataProcessor.prototype.applyUpdate.name} (data update, add source)`, async t => {
	const processor = new DataProcessor();
	{
		const result = processor.applyUpdate({
			updatedSources: new Map([
				["a", new TestSource(`
					foo id=0
				`)],
			]),
		});
		t.is(result.modifiedSources.size, 0);
		t.true(processor.translationDataModified);
		processor.translationDataModified = false;
	}
	{
		const result = processor.applyUpdate({
			translationData: td.translationData({
				fragments: {
					1: td.fragment({
						value: "bar",
					}),
				},
			}),
			updatedSources: new Map([
				["b", new TestSource(`
					bar id=1
				`)],
			]),
		});
		t.is(result.modifiedSources.size, 0);
		t.true(processor.translationDataModified);
		td.verifyFragments(t, processor.translationData, {
			0: { sourceId: "a", value: "foo" },
			1: { sourceId: "b", value: "bar" },
		});
	}
});

test(`${DataProcessor.prototype.applyUpdate.name} (data update, update source)`, async t => {
	const processor = new DataProcessor();
	{
		const result = processor.applyUpdate({
			updatedSources: new Map([
				["a", new TestSource(`
					foo id=0
				`)],
			]),
		});
		t.is(result.modifiedSources.size, 0);
		t.true(processor.translationDataModified);
		processor.translationDataModified = false;
	}
	{
		const result = processor.applyUpdate({
			translationData: td.translationData({
				fragments: {},
			}),
			updatedSources: new Map([
				["a", new TestSource(`
					bar id=0
				`)],
			]),
		});
		t.is(result.modifiedSources.size, 0);
		t.true(processor.translationDataModified);
		td.verifyFragments(t, processor.translationData, {
			0: { sourceId: "a", value: "bar" },
		});
	}
});

test(`${DataProcessor.prototype.applyUpdate.name} (data update, removed source)`, async t => {
	const processor = new DataProcessor();
	{
		const result = processor.applyUpdate({
			updatedSources: new Map([
				["a", new TestSource(`
					foo id=0
				`)],
			]),
		});
		t.is(result.modifiedSources.size, 0);
		t.true(processor.translationDataModified);
		processor.translationDataModified = false;
	}
	{
		const result = processor.applyUpdate({
			translationData: td.translationData({
				fragments: {
					0: td.fragment({
						value: "foo",
					}),
				},
			}),
			removedSources: new Set(["a"]),
		});
		t.is(result.modifiedSources.size, 0);
		t.true(processor.translationDataModified);
		td.verifyFragments(t, processor.translationData, {});
	}
});

test(`${DataProcessor.prototype.getFragmentDiagnostics.name} (empty)`, t => {
	const processor = new DataProcessor();
	t.deepEqual(processor.getFragmentDiagnostics({
		sourceLocale: "en",
		translatedLocales: ["de", "zh"],
	}), []);
});

test(`${DataProcessor.prototype.getFragmentDiagnostics.name} (missing translations)`, t => {
	const processor = new DataProcessor();
	const modified = new Date().toISOString();
	processor.applyUpdate({
		translationData: td.translationData({
			fragments: {
				0: td.fragment({
					value: "foo",
					modified: modified,
				}),
				1: td.fragment({
					value: "bar",
					modified: modified,
					translations: {
						de: { value: "test", modified },
					},
				}),
				2: td.fragment({
					value: "baz",
					modified: modified,
					translations: {
						de: { value: "test", modified },
						zh: { value: "test", modified },
					},
				}),
			},
		}),
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
	const processor = new DataProcessor();
	const modified = new Date().toISOString();
	processor.applyUpdate({
		translationData: td.translationData({
			fragments: {
				0: td.fragment({
					value: "foo",
					modified,
					translations: {
						de: { value: "test", modified },
						zh: { value: "test", modified },
					},
				}),
				1: td.fragment({
					value: "bar",
					modified,
					translations: {
						de: { value: "test", modified },
					},
				}),
			},
		}),
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
	const processor = new DataProcessor();
	const modified = new Date().toISOString();
	processor.applyUpdate({
		translationData: td.translationData({
			fragments: {
				0: td.fragment({
					value: "foo",
					modified,
					translations: {
						de: { value: "test", modified },
						zh: { value: "test", modified: new Date(Date.parse(modified) - 1000).toISOString() },
					},
				}),
				1: td.fragment({
					value: "bar",
					modified,
					translations: {
						de: { value: "test", modified },
						zh: { value: "test", modified },
					},
				}),
			},
		}),
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

test(`${DataProcessor.prototype.getFragmentDiagnostics.name} (duplicate fragment)`, t => {
	const processor = new DataProcessor();
	const modified = new Date().toISOString();
	processor.applyUpdate({
		translationData: td.translationData({
			fragments: {
				1: td.fragment({
					value: "baz",
					sourceId: "b",
					modified,
					translations: {
						en: { value: "test", modified },
					},
				}),
			},
		}),
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
	t.false(processor.translationDataModified);
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
	const processor = new DataProcessor();
	const modified = new Date().toISOString();
	processor.applyUpdate({
		translationData: td.translationData({
			fragments: {
				0: td.fragment({
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
	const processor = new DataProcessor();
	const modified = new Date().toISOString();
	processor.applyUpdate({
		translationData: td.translationData({
			fragments: {
				0: td.fragment({
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
	const processor = new DataProcessor();
	const modified = new Date().toISOString();
	processor.applyUpdate({
		translationData: td.translationData({
			fragments: {
				0: td.fragment({
					value: "foo",
					modified,
					translations: {
						bar: { value: "foo", modified },
						baz: { value: "bar", modified },
					},
				}),
			},
		}),
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
	const processor = new DataProcessor();
	const modified = new Date().toISOString();

	processor.applyUpdate({
		translationData: td.translationData({
			fragments: {
				0: td.fragment({
					value: "foo",
					sourceId: "a",
					modified,
					translations: {
						en: { value: "test", modified },
					},
				}),
				1: td.fragment({
					value: "bar",
					sourceId: "a",
					modified,
					translations: {
						en: { value: "test", modified: new Date(Date.parse(modified) - 1000).toISOString() },
					},
				}),
				2: td.fragment({
					value: "boo",
					sourceId: "a",
					modified,
					translations: {
						en: { value: "test", modified },
					},
				}),
				3: td.fragment({
					value: "test",
					sourceId: "a",
					modified,
					translations: {
						en: { value: { type: "plural", value: ["a", "b"] }, modified },
					},
				}),
				4: td.fragment({
					sourceId: "a",
					modified,
					translations: {
						en: { value: "test", modified },
					},
				}),
				5: td.fragment({
					sourceId: "a",
					modified,
					enabled: false,
					translations: {
						en: { value: "test", modified },
					},
				}),
			},
		}),
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
		localeDataFilenames: new Map([
			["en", "/test/dist/en.json"],
			["de", "/test/dist/hashed/de.1234.json"],
		]),
		manifestFilename: "/test/dist/manifest.json",
	}), {
		version: 1,
		locales: {
			en: "en.json",
			de: "hashed/de.1234.json",
		},
		files: {
			"": {
				fragmentIds: ["9"],
			},
			"a.js": {
				fragmentIds: ["0", "1", "2", "3", "5"],
			},
			"b.js": {
				fragmentIds: ["7", "8"],
			},
		},
	});
});
