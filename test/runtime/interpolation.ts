import test, { ExecutionContext, Macro } from "ava";

import { defaultLocaleFactory, Formatter, Formatters, InterpolationFields, U27N } from "../../src/runtime/index.js";

const interpolate: Macro<[string, InterpolationFields, string, Formatters?]> = {
	title: title => `default interpolation: ${title}`,
	async exec(t: ExecutionContext, value: string, fields: InterpolationFields, output: string, formatters?: Formatters) {
		{
			const controller = new U27N({
				localeFactory: defaultLocaleFactory,
			});
			await controller.setLocale("en");
			const locale = controller.locale!;
			t.is(locale.interpolate(value, fields, formatters), output);
		}

		if (formatters !== undefined) {
			const controller = new U27N({
				localeFactory: defaultLocaleFactory,
				formatters,
			});
			await controller.setLocale("en");
			const locale = controller.locale!;
			t.is(locale.interpolate(value, fields), output, "controller formatters not used");
		}
	},
};

test("no fields", interpolate, "foo", {}, "foo");
test("missing field", interpolate, "{a}", {}, "undefined");
test("string fields & escaping", interpolate, "{a} \\{foo} \\\\{b}", { a: "1", b: "2" }, "1 {foo} \\2");
test("default string formatter", interpolate, "{a}", { a: 42 }, "42");

test("typeof based formatters", interpolate, "{a} {b}", {
	a: 6n,
	b: Symbol("test"),
}, "42 [test]", new Map<string, Formatter>([
	["bigint", (value: bigint) => String(value * 7n)],
	["symbol", ((value: symbol) => `[${value.description}]`)],
]));

{
	// eslint-disable-next-line @typescript-eslint/no-extraneous-class
	class A {}
	class B extends A {}
	class C extends B {}
	test("prototype based & object fallback", interpolate, "{a} {b} {c}", { a: new A(), b: new B(), c: new C() }, "obj test test", new Map([
		[B.prototype, () => "test"],
		["object", () => "obj"],
	]));
}

test("formatter key & format string", interpolate, "{a, mul} {b, mul, 6}", {
	a: 6,
	b: 7,
}, "42 42", new Map([
	["mul", (value: number, _locale, format) => String(value * (format ? parseInt(format) : 7))],
]));

test("format string escaping", interpolate, "{a, b, c\\,d \\}}", {}, "c,d }", new Map([
	["b", (_value, _locale, format) => format!],
]));

test("format string escaping (trailing whitespace)", interpolate, "{a, b,\\ c}", {}, "c", new Map([
	["b", (_value, _locale, format) => format!],
]));

test("format string escaping (no whitespace)", interpolate, "{a,b,c}", {}, "c", new Map([
	["b", (_value, _locale, format) => format!],
]));
