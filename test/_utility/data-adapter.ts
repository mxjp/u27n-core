import { ExecutionContext } from "ava";

import { DataAdapter } from "../../src/data-adapter.js";
import { DataJson, DefaultDataAdapter, FragmentJson } from "../../src/data-adapter-default.js";

export function verifyFragments(t: ExecutionContext, data: DataJson, partialExpected: Record<string, Partial<FragmentJson>>): void {
	const expected: Record<string, FragmentJson> = {};
	for (const fragmentId in partialExpected) {
		expected[fragmentId] = {
			...data.fragments[fragmentId],
			...partialExpected[fragmentId],
		};
	}
	t.deepEqual(data.fragments, expected);
}

export function fragment(data: Partial<FragmentJson>): FragmentJson {
	return {
		enabled: true,
		value: "test",
		modified: new Date().toISOString(),
		sourceId: "test",
		translations: {},
		...data,
	};
}

export function translationData(data: Partial<DataJson>): DataJson {
	return {
		version: 1,
		fragments: {},
		obsolete: [],
		...data,
	};
}

export function createInertAdapter(data: Partial<DataJson>): DataAdapter {
	const adapter = new DefaultDataAdapter();
	adapter.importJson(translationData(data));
	return adapter;
}

export function importDataJson(adapter: DataAdapter, data: Partial<DataJson>): void {
	if (!(adapter instanceof DefaultDataAdapter)) {
		throw new TypeError("adapter must be a default adapter");
	}
	adapter.importJson(translationData(data));
}

export function exportDataJson(adapter: DataAdapter): DataJson {
	if (!(adapter instanceof DefaultDataAdapter)) {
		throw new TypeError("adapter must be a default adapter");
	}
	return adapter.exportJson();
}

export function clearModified(adapter: DataAdapter): void {
	if (!(adapter instanceof DefaultDataAdapter)) {
		throw new TypeError("adapter must be a default adapter");
	}
	adapter.clearModified();
}
