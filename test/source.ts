import { LineMap } from "@mpt/line-map";
import test from "ava";
import { join } from "path";

import { Source } from "../src/source.js";

test("lineMap", t => {
	const source = new Source("foo\nbar");
	t.true(source.lineMap instanceof LineMap);
	t.is(source.lineMap.text, source.content);
	t.deepEqual(source.lineMap.offsets, [0, 4]);
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
