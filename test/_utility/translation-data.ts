import { ExecutionContext } from "ava";

import { TranslationData } from "../../src/index.js";

export namespace TranslationDataUtility {
	export function verifyFragments(t: ExecutionContext, data: TranslationData, partialExpected: Record<string, Partial<TranslationData.Fragment>>): void {
		const expected: Record<string, TranslationData.Fragment> = {};
		for (const fragmentId in partialExpected) {
			expected[fragmentId] = {
				...data.fragments[fragmentId],
				...partialExpected[fragmentId],
			};
		}
		t.deepEqual(data.fragments, expected);
	}

	export function fragment(data: Partial<TranslationData.Fragment>): TranslationData.Fragment {
		return {
			enabled: true,
			value: "test",
			modified: new Date().toISOString(),
			sourceId: "test",
			translations: {},
			...data,
		};
	}

	export function translationData(data: Partial<TranslationData>): TranslationData {
		return {
			version: 1,
			fragments: {},
			obsolete: [],
			...data,
		};
	}
}
