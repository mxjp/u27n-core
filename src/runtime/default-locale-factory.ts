import { U27N } from "./controller.js";
import * as plurals from "./generated/plurals.js";
import { createInterpolationProcessor } from "./interpolation.js";
import { Locale } from "./locale.js";
import { LocaleCode } from "./locale-code.js";
import { PluralProcessor } from "./pluralization.js";

type Plurals = Record<`plurals_${string}`, PluralProcessor>;

/**
 * The default locale factory.
 *
 * This is not used automatically to reduce the amount of code that needs to be shipped when this is not needed.
 */
export function defaultLocaleFactory(controller: U27N, code: string): Locale {
	return new Locale({
		controller,
		code,

		pluralProcessor: (plurals as Plurals)[`plurals_${code}`]
			?? (plurals as Plurals)[`plurals_${LocaleCode.parse(code).language}`],

		interpolationProcessor: createInterpolationProcessor(controller),
	});
}
