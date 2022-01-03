import test from "ava";

import { plurals_ar, plurals_en } from "../../src/runtime/index.js";

test("sample: en", t => {
	const forms = Array.from("ab");
	t.is(plurals_en(forms, 0), "b");
	t.is(plurals_en(forms, 1), "a");
	t.is(plurals_en(forms, 2), "b");
	t.is(plurals_en(forms, -42), "b");
	t.is(plurals_en(forms, -7.2), "b");
});

test("sample: ar", t => {
	const forms = Array.from("abcdef");
	t.is(plurals_ar(forms, 0), "f");
	t.is(plurals_ar(forms, 1), "a");
	t.is(plurals_ar(forms, 2), "b");
	for (let i = 3; i <= 10; i++) {
		t.is(plurals_ar(forms, i), "c");
		t.is(plurals_ar(forms, 100 + i), "c");
		t.is(plurals_ar(forms, 7700 + i), "c");
	}
	for (let i = 0; i <= 2; i++) {
		t.is(plurals_ar(forms, 100 + i), "e");
		t.is(plurals_ar(forms, 7700 + i), "e");
	}
	t.is(plurals_ar(forms, 277), "d");
});
