import test from "ava";

import { defaultLocaleFactory, FetchClient, LocaleData, U27N } from "../../src/runtime/index.js";

const fetchCalls: string[] = [];
const resources: Record<string, LocaleData> = {
	"en.json": {
		test: {
			42: "Hello World!",
		},
	},
	"de.json": {
		test: {
			42: "Hallo Welt!",
		},
	},
};

globalThis.fetch = (async (url: string) => {
	fetchCalls.push(url);
	return {
		ok: true,
		async json() {
			return JSON.parse(JSON.stringify(resources[url])) as LocaleData;
		},
	};
}) as unknown as typeof fetch;

for (const cache of [false, true]) {
	test.serial(`fetch resources (${cache ? "with" : "without"} cache)`, async t => {
		fetchCalls.length = 0;

		const controller = new U27N({
			localeFactory: defaultLocaleFactory,
			clients: [
				new FetchClient({
					url: "[locale].json",
					cache,
				}),
			],
		});

		await controller.setLocale("en");
		t.deepEqual(fetchCalls, ["en.json"]);
		t.is(controller.locale, controller.getLocale("en"));
		t.deepEqual(controller.locale?.data, {
			test: {
				42: "Hello World!",
			},
		});

		await controller.setLocale("de");
		t.deepEqual(fetchCalls, ["en.json", "de.json"]);
		t.is(controller.locale, controller.getLocale("de"));
		t.deepEqual(controller.locale?.data, {
			test: {
				42: "Hallo Welt!",
			},
		});

		await controller.setLocale("en");
		t.deepEqual(fetchCalls, cache ? ["en.json", "de.json"] : ["en.json", "de.json", "en.json"]);
	});
}

