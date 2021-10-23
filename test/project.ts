import test, { ExecutionContext } from "ava";

import { Project } from "../src/project.js";
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

test(`${Project.prototype.applyUpdate.name} (empty update)`, t => {
	const project = new Project();
	const result = project.applyUpdate({});
	t.is(result.modifiedSources.size, 0);
	t.false(project.translationDataModified);
});

test(`${Project.prototype.applyUpdate.name} (state in sync)`, t => {
	const project = new Project();
	const result = project.applyUpdate({
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
	t.false(project.translationDataModified);
	t.is(result.modifiedSources.size, 0);
});

test(`${Project.prototype.applyUpdate.name} (missing id)`, async t => {
	const project = new Project();
	const result = project.applyUpdate({
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
	t.true(project.translationDataModified);
	verifyFragments(t, project.translationData, {
		0: { sourceId: "b", value: "baz" },
		1: { sourceId: "a", value: "bar" },
		42: { sourceId: "a", value: "foo" },
	});
	project.translationDataModified = false;
	t.false(project.translationDataModified);

	t.deepEqual(result.modifiedSources, new Map([
		["a", source(`
			foo 42
			bar 1
		`)],
	]));
});

test(`${Project.prototype.applyUpdate.name} (duplicate id, multiple sources, no data)`, async t => {
	const project = new Project();
	const result = project.applyUpdate({
		updatedSources: new Map([
			["a", new ManagedTestSource(`
				foo 0
			`)],
			["b", new ManagedTestSource(`
				bar 0
			`)],
		]),
	});

	t.true(project.translationDataModified);
	verifyFragments(t, project.translationData, {
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

test(`${Project.prototype.applyUpdate.name} (duplicate id, single source, no data)`, async t => {
	const project = new Project();
	const result = project.applyUpdate({
		updatedSources: new Map([
			["a", new ManagedTestSource(`
				foo 0
				bar 0
			`)],
		]),
	});

	t.true(project.translationDataModified);
	verifyFragments(t, project.translationData, {
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

test(`${Project.prototype.applyUpdate.name} (duplicate id, multiple sources, data in sync)`, async t => {
	const project = new Project();
	const result = project.applyUpdate({
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

	t.true(project.translationDataModified);
	verifyFragments(t, project.translationData, {
		0: { sourceId: "b", value: "bar" },
		1: { sourceId: "a", value: "foo" },
	});

	t.deepEqual(result.modifiedSources, new Map([
		["a", source(`
			foo 1
		`)],
	]));
});

test(`${Project.prototype.applyUpdate.name} (duplicate id, single source, data in sync)`, async t => {
	const project = new Project();
	const result = project.applyUpdate({
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

	t.true(project.translationDataModified);
	verifyFragments(t, project.translationData, {
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

test(`${Project.prototype.applyUpdate.name} (duplicate id, multiple sources, data out of sync)`, async t => {
	const project = new Project();
	const result = project.applyUpdate({
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

	t.true(project.translationDataModified);
	verifyFragments(t, project.translationData, {
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

test(`${Project.prototype.applyUpdate.name} (duplicate id, single source, data out of sync)`, async t => {
	const project = new Project();
	const result = project.applyUpdate({
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

	t.true(project.translationDataModified);
	verifyFragments(t, project.translationData, {
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

test(`${Project.prototype.applyUpdate.name} (remove source)`, t => {
	const project = new Project();

	project.applyUpdate({
		updatedSources: new Map([
			["a", new ManagedTestSource(`
				foo 0
			`)],
		]),
	});
	verifyFragments(t, project.translationData, {
		0: { sourceId: "a", value: "foo" },
	});
	project.translationDataModified = false;
	t.false(project.translationDataModified);

	const result = project.applyUpdate({
		removedSources: new Set(["a"]),
	});
	t.is(result.modifiedSources.size, 0);

	t.true(project.translationDataModified);
	verifyFragments(t, project.translationData, {});
});

test(`${Project.prototype.applyUpdate.name} (missing source)`, t => {
	const project = new Project();
	const result = project.applyUpdate({
		translationData: translationData({
			fragments: {
				0: fragment({}),
			},
		}),
	});
	t.is(result.modifiedSources.size, 0);
	t.true(project.translationDataModified);
	verifyFragments(t, project.translationData, {});
});
