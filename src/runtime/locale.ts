import { U27N } from "./controller.js";
import { Formatters, InterpolationFields, InterpolationProcessor } from "./interpolation.js";
import { LocaleData } from "./locale-data.js";
import { PluralProcessor } from "./pluralization.js";

/**
 * Represents a specific locale with it's data.
 */
export class Locale {
	/**
	 * The controller that this locale was created for.
	 */
	readonly controller: U27N;

	/**
	 * The locale code.
	 */
	readonly code: string;

	/**
	 * The data for this locale.
	 */
	readonly data: LocaleData;

	readonly #pluralProcessor: PluralProcessor | undefined;
	readonly #interpolationProcessor: InterpolationProcessor | undefined;

	constructor(options: Locale.Options) {
		this.controller = options.controller;
		this.code = options.code;
		this.data = Object.create(null) as {};
		this.#pluralProcessor = options.pluralProcessor;
		this.#interpolationProcessor = options.interpolationProcessor;
	}

	/**
	 * Add data to this locale.
	 */
	addData(data: LocaleData): void {
		for (const namespace in data) {
			const source = data[namespace];
			const current = this.data[namespace];
			this.data[namespace] = current ? { ...current, ...source } : source;
		}
	}

	/**
	 * Get a translation.
	 *
	 * @param namespace The namespace.
	 * @param id The fragment id.
	 */
	translate(namespace: string, id: string): LocaleData.Value | undefined {
		return this.data[namespace]?.[id];
	}

	/**
	 * Choose a plural form using the plural processor for this locale.
	 *
	 * This throws an error if pluralization is not supported by this locale.
	 *
	 * @param value The plural value to choose from.
	 * @param count The count to choose the plural form for.
	 */
	pluralize(value: string[], count: number): string {
		const processor = this.#pluralProcessor;
		if (processor === undefined) {
			throw new Error(`pluralization is disabled for locale "${this.code}"`);
		}
		return processor(value, count);
	}

	/**
	 * Apply interpolation using the interpolation processor for this locale.
	 *
	 * This throws an error if interpolation is not supported by this locale.
	 *
	 * @param value The value to apply interpolation to.
	 * @param fields An object with fields available for interpolation.
	 * @param formatters An optional object with additional formatters to use.
	 */
	interpolate(value: string, fields: InterpolationFields, formatters?: Formatters): string {
		const processor = this.#interpolationProcessor;
		if (processor === undefined) {
			throw new Error(`interpolation is disabled for locale "${this.code}"`);
		}
		return processor(value, fields, this, formatters);
	}
}

export declare namespace Locale {
	export interface Options {
		/**
		 * The controller that this locale was created for.
		 */
		controller: U27N;

		/**
		 * The locale code.
		 */
		code: string;

		/**
		 * The plural processor for this locale.
		 *
		 * If not set, this locale will not support pluralization.
		 */
		pluralProcessor?: PluralProcessor;

		/**
		 * The interpolation processor for this locale.
		 *
		 * If not set, this locale will not support interpolation.
		 */
		interpolationProcessor?: InterpolationProcessor;
	}
}
