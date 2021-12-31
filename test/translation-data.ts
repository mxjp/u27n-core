import test from "ava";

import { TranslationData } from "../src/translation-data.js";

test(`${TranslationData.formatJson.name}`, t => {
	const now = Date.now();

	function fragment(i: number): TranslationData.Fragment {
		return {
			enabled: true,
			modified: new Date(now + (i * 1000)).toISOString(),
			sourceId: "src/test.txt",
			translations: {},
			value: `test ${i}`,
		};
	}

	const data: TranslationData = {
		obsolete: [
			["7", fragment(5)],
			["5", fragment(7)],
			["5", fragment(9)],
			["5", fragment(5)],
		],
		fragments: {
			1: fragment(1),
			0: fragment(0),
			2: fragment(2),
		},
		version: 1,
	};

	t.is(TranslationData.formatJson(data, false), JSON.stringify(data, null, "\t") + "\n");
	t.is(TranslationData.formatJson(data, true), JSON.stringify({
		version: 1,
		fragments: {
			0: fragment(0),
			1: fragment(1),
			2: fragment(2),
		},
		obsolete: [
			["5", fragment(5)],
			["5", fragment(7)],
			["5", fragment(9)],
			["7", fragment(5)],
		],
	}, null, "\t") + "\n");
});
