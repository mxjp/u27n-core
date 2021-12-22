import test from "ava";

import { base62encode } from "../../src/utility/base62.js";

test("encode", t => {
	t.is(base62encode(0), "0");
	t.is(base62encode(1), "1");
	t.is(base62encode(61), "z");
	t.is(base62encode(62), "10");
	t.is(base62encode(3843), "zz");
});
