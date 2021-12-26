import test, { ExecutionContext } from "ava";

import { DataProcessor } from "../src/data-processor.js";
import { TranslationData } from "../src/translation-data.js";
import { ManagedTestSource } from "./_utility/managed-test-source.js";
import { unindent } from "./_utility/unindent.js";

function verifyFragments(t: ExecutionContext, data: TranslationData, partialExpected: Record<string, Partial<TranslationData.Fragment>>): void {
	const expected: Record<string, TranslationData.Fragment> = {};
	for (const fragmentId in partialExpected) {
		expected[fragmentId] = {
			...data.fragments[fragmentId],
			...partialExpected[fragmentId],
		};
	}
	t.deepEqual(data.fragments, expected);
}

function fragment(data: Partial<TranslationData.Fragment>): TranslationData.Fragment {
	return {
		enabled: true,
		value: "test",
		modified: new Date().toISOString(),
		sourceId: "test",
		translations: {},
		...data,
	};
}

function translationData(data: Partial<TranslationData>): TranslationData {
	return {
		version: 1,
		fragments: {},
		obsolete: [],
		...data,
	};
}

function source(code: string): string {
	return unindent(code).trim();
}

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
			["a", new ManagedTestSource(`
				foo 0
				bar 1
			`)],
			["b", new ManagedTestSource(`
				baz 2
			`)],
		]),
		translationData: translationData({
			fragments: {
				0: fragment({ sourceId: "a", value: "foo" }),
				1: fragment({ sourceId: "a", value: "bar" }),
				2: fragment({ sourceId: "b", value: "baz" }),
			},
		}),
	});
	t.false(processor.translationDataModified);
	t.is(result.modifiedSources.size, 0);
});

test(`${DataProcessor.prototype.applyUpdate.name} (missing id)`, async t => {
	const processor = new DataProcessor();
	const result = processor.applyUpdate({
		updatedSources: new Map([
			["a", new ManagedTestSource(`
				foo 42
				bar
			`)],
			["b", new ManagedTestSource(`
				baz 0
			`)],
		]),
		translationData: translationData({
			fragments: {
				0: fragment({ sourceId: "b", value: "baz" }),
			},
		}),
	});
	t.true(processor.translationDataModified);
	verifyFragments(t, processor.translationData, {
		0: { sourceId: "b", value: "baz" },
		1: { sourceId: "a", value: "bar" },
		42: { sourceId: "a", value: "foo" },
	});
	processor.translationDataModified = false;
	t.false(processor.translationDataModified);

	t.deepEqual(result.modifiedSources, new Map([
		["a", source(`
			foo 42
			bar 1
		`)],
	]));
});

test(`${DataProcessor.prototype.applyUpdate.name} (duplicate id, multiple sources, no data)`, async t => {
	const processor = new DataProcessor();
	const result = processor.applyUpdate({
		updatedSources: new Map([
			["a", new ManagedTestSource(`
				foo 0
			`)],
			["b", new ManagedTestSource(`
				bar 0
			`)],
		]),
	});

	t.true(processor.translationDataModified);
	verifyFragments(t, processor.translationData, {
		1: { sourceId: "a", value: "foo" },
		2: { sourceId: "b", value: "bar" },
	});

	t.deepEqual(result.modifiedSources, new Map([
		["a", source(`
			foo 1
		`)],
		["b", source(`
			bar 2
		`)],
	]));
});

test(`${DataProcessor.prototype.applyUpdate.name} (duplicate id, single source, no data)`, async t => {
	const processor = new DataProcessor();
	const result = processor.applyUpdate({
		updatedSources: new Map([
			["a", new ManagedTestSource(`
				foo 0
				bar 0
			`)],
		]),
	});

	t.true(processor.translationDataModified);
	verifyFragments(t, processor.translationData, {
		0: { sourceId: "a", value: "foo" },
		1: { sourceId: "a", value: "bar" },
	});

	t.deepEqual(result.modifiedSources, new Map([
		["a", source(`
			foo 0
			bar 1
		`)],
	]));
});

test(`${DataProcessor.prototype.applyUpdate.name} (duplicate id, multiple sources, data in sync)`, async t => {
	const processor = new DataProcessor();
	const result = processor.applyUpdate({
		updatedSources: new Map([
			["a", new ManagedTestSource(`
				foo 0
			`)],
			["b", new ManagedTestSource(`
				bar 0
			`)],
		]),
		translationData: translationData({
			fragments: {
				0: fragment({ sourceId: "b", value: "bar" }),
			},
		}),
	});

	t.true(processor.translationDataModified);
	verifyFragments(t, processor.translationData, {
		0: { sourceId: "b", value: "bar" },
		1: { sourceId: "a", value: "foo" },
	});

	t.deepEqual(result.modifiedSources, new Map([
		["a", source(`
			foo 1
		`)],
	]));
});

test(`${DataProcessor.prototype.applyUpdate.name} (duplicate id, single source, data in sync)`, async t => {
	const processor = new DataProcessor();
	const result = processor.applyUpdate({
		updatedSources: new Map([
			["a", new ManagedTestSource(`
				foo 0
				bar 0
			`)],
		]),
		translationData: translationData({
			fragments: {
				0: fragment({ sourceId: "b", value: "bar" }),
			},
		}),
	});

	t.true(processor.translationDataModified);
	verifyFragments(t, processor.translationData, {
		0: { sourceId: "a", value: "foo" },
		1: { sourceId: "a", value: "bar" },
	});

	t.deepEqual(result.modifiedSources, new Map([
		["a", source(`
			foo 0
			bar 1
		`)],
	]));
});

test(`${DataProcessor.prototype.applyUpdate.name} (duplicate id, multiple sources, data out of sync)`, async t => {
	const processor = new DataProcessor();
	const result = processor.applyUpdate({
		updatedSources: new Map([
			["a", new ManagedTestSource(`
				foo 0
			`)],
			["b", new ManagedTestSource(`
				bar 0
			`)],
		]),
		translationData: translationData({
			fragments: {
				0: fragment({ sourceId: "a", value: "baz" }),
			},
		}),
	});

	t.true(processor.translationDataModified);
	verifyFragments(t, processor.translationData, {
		1: { sourceId: "a", value: "foo" },
		2: { sourceId: "b", value: "bar" },
	});

	t.deepEqual(result.modifiedSources, new Map([
		["a", source(`
			foo 1
		`)],
		["b", source(`
			bar 2
		`)],
	]));
});

test(`${DataProcessor.prototype.applyUpdate.name} (duplicate id, single source, data out of sync)`, async t => {
	const processor = new DataProcessor();
	const result = processor.applyUpdate({
		updatedSources: new Map([
			["a", new ManagedTestSource(`
				foo 0
				bar 0
			`)],
		]),
		translationData: translationData({
			fragments: {
				0: fragment({ sourceId: "a", value: "baz" }),
			},
		}),
	});

	t.true(processor.translationDataModified);
	verifyFragments(t, processor.translationData, {
		0: { sourceId: "a", value: "foo" },
		1: { sourceId: "a", value: "bar" },
	});

	t.deepEqual(result.modifiedSources, new Map([
		["a", source(`
			foo 0
			bar 1
		`)],
	]));
});

test(`${DataProcessor.prototype.applyUpdate.name} (remove source)`, t => {
	const processor = new DataProcessor();

	processor.applyUpdate({
		updatedSources: new Map([
			["a", new ManagedTestSource(`
				foo 0
			`)],
		]),
	});
	verifyFragments(t, processor.translationData, {
		0: { sourceId: "a", value: "foo" },
	});
	processor.translationDataModified = false;
	t.false(processor.translationDataModified);

	const result = processor.applyUpdate({
		removedSources: new Set(["a"]),
	});
	t.is(result.modifiedSources.size, 0);

	t.true(processor.translationDataModified);
	verifyFragments(t, processor.translationData, {});
});

test(`${DataProcessor.prototype.applyUpdate.name} (missing source)`, t => {
	const processor = new DataProcessor();
	const result = processor.applyUpdate({
		translationData: translationData({
			fragments: {
				0: fragment({}),
			},
		}),
	});
	t.is(result.modifiedSources.size, 0);
	t.true(processor.translationDataModified);
	verifyFragments(t, processor.translationData, {});
});

test(`${DataProcessor.prototype.applyUpdate.name} (data update, add source)`, async t => {
	const processor = new DataProcessor();
	{
		const result = processor.applyUpdate({
			updatedSources: new Map([
				["a", new ManagedTestSource(`
					foo 0
				`)],
			]),
		});
		t.is(result.modifiedSources.size, 0);
		t.true(processor.translationDataModified);
		processor.translationDataModified = false;
	}
	{
		const result = processor.applyUpdate({
			translationData: translationData({
				fragments: {
					1: fragment({
						value: "bar",
					}),
				},
			}),
			updatedSources: new Map([
				["b", new ManagedTestSource(`
					bar 1
				`)],
			]),
		});
		t.is(result.modifiedSources.size, 0);
		t.true(processor.translationDataModified);
		verifyFragments(t, processor.translationData, {
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
				["a", new ManagedTestSource(`
					foo 0
				`)],
			]),
		});
		t.is(result.modifiedSources.size, 0);
		t.true(processor.translationDataModified);
		processor.translationDataModified = false;
	}
	{
		const result = processor.applyUpdate({
			translationData: translationData({
				fragments: {},
			}),
			updatedSources: new Map([
				["a", new ManagedTestSource(`
					bar 0
				`)],
			]),
		});
		t.is(result.modifiedSources.size, 0);
		t.true(processor.translationDataModified);
		verifyFragments(t, processor.translationData, {
			0: { sourceId: "a", value: "bar" },
		});
	}
});

test(`${DataProcessor.prototype.applyUpdate.name} (data update, removed source)`, async t => {
	const processor = new DataProcessor();
	{
		const result = processor.applyUpdate({
			updatedSources: new Map([
				["a", new ManagedTestSource(`
					foo 0
				`)],
			]),
		});
		t.is(result.modifiedSources.size, 0);
		t.true(processor.translationDataModified);
		processor.translationDataModified = false;
	}
	{
		const result = processor.applyUpdate({
			translationData: translationData({
				fragments: {
					0: fragment({
						value: "foo",
					}),
				},
			}),
			removedSources: new Set(["a"]),
		});
		t.is(result.modifiedSources.size, 0);
		t.true(processor.translationDataModified);
		verifyFragments(t, processor.translationData, {});
	}
});
