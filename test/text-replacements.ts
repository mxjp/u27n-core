import test from "ava";

import { TextReplacements } from "../src/text-replacements.js";

test("empty", t => {
	t.is(new TextReplacements("foo").format(), "foo");
});

test("updates", t => {
	t.is(
		new TextReplacements("0123456")
			.replace({ start: 1, end: 2, text: "aa" })
			.replace({ start: 3, end: 3, text: "bb" })
			.replace({ start: 5, end: 6, text: "cc" })
			.format(),
		"0aa2bb34cc6",
	);
});

test("error conditions", t => {
	const updates = new TextReplacements("foo");
	updates.replace({ start: 0, end: 1, text: "" });
	t.throws(() => updates.replace({ start: 0, end: 1, text: "" }));
	t.throws(() => updates.replace({ start: 1, end: 4, text: "" }));
});
