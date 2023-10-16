import { Context } from "./context.js";

/**
 * Wrap a translation function to call a function before translating any value.
 *
 * This can be used with libraries that use signals to update translated values when the locale has been changed.
 */
export function wrapSignalT(t: Context.T, useSignal: () => void): Context.T {
	return function (this: unknown) {
		useSignal();
		// eslint-disable-next-line prefer-rest-params
		return (t as () => string).apply(this, arguments as unknown as []);
	} as unknown as Context.T;
}
