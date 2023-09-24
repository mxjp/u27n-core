import { join } from "node:path";

import { LineMap } from "@mpt/line-map";
import test from "ava";

import { Source } from "../src/source.js";
import { filenameToSourceId, sourceIdToFilename } from "../src/source-id.js";
import { TextSource } from "../src/text-source.js";

test("lineMap", t => {
	const source = new TextSource("foo\nbar");
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

	const source = new class extends TextSource {
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
	t.is(filenameToSourceId("/foo", "/foo/bar/baz"), "bar/baz");
	t.is(filenameToSourceId("/foo", "/bar"), "../bar");
});

test("sourceIdToFilename", t => {
	t.is(sourceIdToFilename("/foo", "bar/baz"), join("/foo", "bar/baz"));
	t.is(sourceIdToFilename("/foo", "../bar"), join("/foo", "../bar"));
});
