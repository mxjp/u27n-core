import test from "ava";

import { SourceUpdates } from "../src/source-updates.js";

test("empty", t => {
	t.is(new SourceUpdates("foo").format(), "foo");
});

test("updates", t => {
	t.is(
		new SourceUpdates("0123456")
			.append({ start: 1, end: 2, text: "aa" })
			.append({ start: 3, end: 3, text: "bb" })
			.append({ start: 5, end: 6, text: "cc" })
			.format(),
		"0aa2bb34cc6",
	);
});

test("error conditions", t => {
	const updates = new SourceUpdates("foo");
	updates.append({ start: 0, end: 1, text: "" });
	t.throws(() => updates.append({ start: 0, end: 1, text: "" }));
	t.throws(() => updates.append({ start: 1, end: 4, text: "" }));
});
