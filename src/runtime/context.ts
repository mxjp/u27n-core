import { U27N } from "./controller.js";
import { Formatters, InterpolationFields } from "./interpolation.js";
import { LocaleData } from "./locale-data.js";

/**
 * A context provides a way to translate values in a specific namespace and the controllers current locale.
 */
export class Context {
	/**
	 * @param controller The controller to use.
	 * @param namespace The namespace that translated values are in.
	 * @param sourceLocale The locale of values as passed to the translation function.
	 */
	constructor(
		readonly controller: U27N,
		readonly namespace: string,
		readonly sourceLocale: string,
	) {
		this.t = this.t.bind(this);
	}

	/**
	 * Translate a value using this context.
	 *
	 * It is guaranteed that this function is bound to this context.
	 *
	 * @param value The value to translate in the source locale.
	 * @param options An object with attitional options.
	 * @param id The fragment id. This will be automatically set when running the toolchain.
	 */
	t(value: string, id: string): string;
	t(value: string, options: Context.TInterpolationOptions, id: string): string;
	t(value: string[], options: Context.TPluralOptions & Context.TInterpolationOptions, id: string): string;
	t(value: LocaleData.Value, optionsOrId: Partial<Context.TPluralOptions & Context.TInterpolationOptions> | string, id?: string): string {
		const locale = this.controller.locale!;

		if (typeof optionsOrId === "string") {
			return locale.code === this.sourceLocale
				? value as string
				: locale.translate(this.namespace, optionsOrId) as string;
		}

		let result = locale.code === this.sourceLocale ? value : locale.translate(this.namespace, id!)!;
		if (optionsOrId.count !== undefined) {
			result = locale.pluralize(result as string[], optionsOrId.count);
		}

		if (optionsOrId.fields !== undefined) {
			result = locale.interpolate(
				result as string,
				{
					count: optionsOrId.count,
					...optionsOrId.fields,
				},
				optionsOrId.formatters
			);
		} else if (optionsOrId.count !== undefined) {
			result = locale.interpolate(
				result as string,
				{
					count: optionsOrId.count,
				},
				optionsOrId.formatters
			);
		}

		return result as string;
	}
}

export declare namespace Context {
	export type T = typeof Context.prototype.t;

	export interface TPluralOptions {
		/**
		 * The count to use for pluralization.
		 *
		 * This is also available for interpolation as `count`.
		 */
		count: number;
	}

	export interface TInterpolationOptions {
		/**
		 * The fields available for interpolation.
		 */
		fields?: InterpolationFields;

		/**
		 * A map with formatters available for interpolation.
		 */
		formatters?: Formatters;
	}
}
