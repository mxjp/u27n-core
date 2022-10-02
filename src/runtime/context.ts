import { Formatters, InterpolationFields, LocaleData, U27N } from ".";

export class Context {
	public constructor(
		public readonly controller: U27N,
		public readonly namespace: string,
		public readonly sourceLocale: string,
	) {
		this.t = this.t.bind(this);
	}

	public t(value: string, id: string): string;
	public t(value: string, options: Context.TInterpolationOptions, id: string): string;
	public t(value: string[], options: Context.TPluralOptions & Context.TInterpolationOptions, id: string): string;
	public t(value: LocaleData.Value, optionsOrId: Partial<Context.TPluralOptions & Context.TInterpolationOptions> | string, id?: string): string {
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
		count: number;
	}

	export interface TInterpolationOptions {
		fields?: InterpolationFields;
		formatters?: Formatters;
	}
}
