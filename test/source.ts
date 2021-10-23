import test from "ava";
import { join } from "path";

import { Source } from "../src/source.js";
import { unindent } from "./_utility/unindent.js";

test("lineMap", t => {
	([
		["", [0]],
		["\n", [0, 1]],
		[`foo\nbar`, [0, 4]],
		[`
			Hello World!
			foo
			bar
		`, [0, 1, 14, 18, 22]],
	] as [string, number[]][]).forEach(([content, lineMap]) => {
		const source = new Source(unindent(content));
		t.deepEqual(source.lineMap, lineMap);
	});
});

test("locationToOffset / offsetToLocation", t => {
	const source = new Source(`foo\nbar\nbaz`);
	([
		[-1, undefined],
		[undefined, { line: -1, column: 0 }],
		[undefined, { line: 0, column: -1 }],
		[0, { line: 0, column: 0 }],
		[1, { line: 0, column: 1 }],
		[2, { line: 0, column: 2 }],
		[3, { line: 0, column: 3 }],
		[undefined, { line: 0, column: 4 }],
		[undefined, { line: 1, column: -1 }],
		[4, { line: 1, column: 0 }],
		[5, { line: 1, column: 1 }],
		[6, { line: 1, column: 2 }],
		[7, { line: 1, column: 3 }],
		[undefined, { line: 1, column: 4 }],
		[undefined, { line: 2, column: -1 }],
		[8, { line: 2, column: 0 }],
		[9, { line: 2, column: 1 }],
		[10, { line: 2, column: 2 }],
		[undefined, { line: 2, column: 3 }],
		[11, undefined],
	] as [number | undefined, Source.Location | undefined][]).forEach(([offset, location]) => {
		if (location !== undefined) {
			t.is(source.locationToOffset(location), offset);
		}
		if (offset !== undefined) {
			t.deepEqual(source.offsetToLocation(offset), location);
		}
	});
	t.pass();
});

test("fragments / fragmentMap", t => {
	const fragments: Source.Fragment[] = [
		{
			fragmentId: "a",
			value: "foo",
			enabled: true,
			end: 0,
			start: 0,
		},
		{
			fragmentId: "b",
			value: "bar",
			enabled: true,
			end: 0,
			start: 0,
		},
		{
			fragmentId: "b",
			value: "baz",
			enabled: true,
			end: 0,
			start: 0,
		},
	];

	const source = new class extends Source {
		public parse(): Source.Fragment[] {
			return fragments;
		}
	}("");

	t.deepEqual(source.fragments, fragments);
	t.deepEqual(source.fragmentMap, new Map([
		["a", fragments[0]],
		["b", fragments[2]],
	]));
});

test("filenameToSourceId", t => {
	t.is(Source.filenameToSourceId("/foo", "/foo/bar/baz"), "bar/baz");
	t.is(Source.filenameToSourceId("/foo", "/bar"), "../bar");
	t.is(Source.filenameToSourceId("C:\\foo", "C:\\foo\\bar\\baz"), "bar/baz");
	t.is(Source.filenameToSourceId("C:\\foo", "C:\\bar"), "../bar");
});

test("sourceIdToFilename", t => {
	t.is(Source.sourceIdToFilename("/foo", "bar/baz"), join("/foo", "bar/baz"));
	t.is(Source.sourceIdToFilename("/foo", "../bar"), join("/foo", "../bar"));
});
