import test from "ava";

import { Context, defaultLocaleFactory, U27N } from "../../src/runtime/index.js";
import { StaticClient } from "../_utility/static-client.js";

test("basic translation", async t => {
	const controller = new U27N({
		localeFactory: defaultLocaleFactory,
		clients: [
			new StaticClient([
				["en", {}],
				["de", {
					test: {
						simple: "einfacher Wert",
						plural: [
							"{count} Wert",
							"{count} Werte",
						],
					},
				}],
			]),
		],
	});
	const context = new Context(controller, "test", "en");

	await controller.setLocale("en");
	t.is(context.t("simple value", "simple"), "simple value");

	for (const [count, translated] of [
		[0, "0 values"],
		[1, "1 value"],
		[2, "2 values"],
	] as [number, string][]) {
		t.is(context.t(["{count} value", "{count} values"], { count }, "plural"), translated);
	}

	await controller.setLocale("de");
	t.is(context.t("simple value", "simple"), "einfacher Wert");

	for (const [count, translated] of [
		[0, "0 Werte"],
		[1, "1 Wert"],
		[2, "2 Werte"],
	] as [number, string][]) {
		t.is(context.t(["{count} value", "{count} values"], { count }, "plural"), translated);
	}
});
