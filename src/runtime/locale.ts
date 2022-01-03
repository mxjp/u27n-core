import { U27N } from "./controller.js";
import { Formatters, InterpolationFields, InterpolationProcessor } from "./interpolation.js";
import { LocaleData } from "./locale-data.js";
import { PluralProcessor } from "./pluralization.js";

export class Locale {
	public readonly controller: U27N;
	public readonly code: string;
	public readonly data: LocaleData;

	readonly #pluralProcessor: PluralProcessor | undefined;
	readonly #interpolationProcessor: InterpolationProcessor | undefined;

	public constructor(options: Locale.Options) {
		this.controller = options.controller;
		this.code = options.code;
		this.data = Object.create(null) as {};
		this.#pluralProcessor = options.pluralProcessor;
		this.#interpolationProcessor = options.interpolationProcessor;
	}

	public addData(data: LocaleData): void {
		for (const namespace in data) {
			const source = data[namespace];
			const current = this.data[namespace];
			this.data[namespace] = current ? { ...current, ...source } : source;
		}
	}

	public translate(namespace: string, id: string): LocaleData.Value | undefined {
		return this.data[namespace]?.[id];
	}

	public pluralize(value: string[], count: number): string {
		const processor = this.#pluralProcessor;
		if (processor === undefined) {
			throw new Error(`pluralization is disabled for locale "${this.code}"`);
		}
		return processor(value, count);
	}

	public interpolate(value: string, fields: InterpolationFields, formatters?: Formatters): string {
		const processor = this.#interpolationProcessor;
		if (processor === undefined) {
			throw new Error(`interpolation is disabled for locale "${this.code}"`);
		}
		return processor(value, fields, this, formatters);
	}
}

export declare namespace Locale {
	export interface Options {
		controller: U27N;
		code: string;
		pluralProcessor?: PluralProcessor;
		interpolationProcessor?: InterpolationProcessor;
	}
}
