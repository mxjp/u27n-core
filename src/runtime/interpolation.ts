import { U27N } from "./controller.js";
import { Locale } from "./locale.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Formatter<T = any> {
	(value: T, locale: Locale, format?: string): string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Formatters = Map<any, Formatter>;

export interface InterpolationProcessor {
	(value: string, fields: InterpolationFields, locale: Locale, formatters?: Formatters): string;
}

export type InterpolationFields = Record<string, unknown>;

export function createInterpolationProcessor(controller: U27N): InterpolationProcessor {
	const hasOwnProperty = Object.prototype.hasOwnProperty;
	return (value, fields, locale, formatters) => {
		return value.replace(/\\([^])|\{((?:\\[^]|[^\\}])*)\}/g, (match, escaped: string, content: string) => {
			if (escaped !== undefined) {
				return escaped;
			}

			const parts: string[] = [""];
			let start = 0;
			for (let i = 0; i < content.length; i++) {
				const char = content[i];
				if (char === "\\") {
					parts[parts.length - 1] += content.slice(start, i);
					start = ++i;
				} else if (char === ",") {
					parts[parts.length - 1] += content.slice(start, i);
					parts.push("");
					start = i + 1;
				}
			}
			parts[parts.length - 1] += content.slice(start);
			if (parts.length > 3) {
				throw new TypeError(`invalid interpolation: ${JSON.stringify(match)}`);
			}

			const name = parts[0].trim();
			const formatterKey = parts[1]?.trim();
			const format = parts[2]?.trim();

			const value = hasOwnProperty.call(fields, name) ? fields[name] : undefined;

			if (formatterKey !== undefined) {
				const formatter = formatters?.get(formatterKey) ?? controller.formatters.get(formatterKey);
				if (formatter === undefined) {
					throw new TypeError(`unknown formatter: ${JSON.stringify(formatterKey)}`);
				}
				return formatter(value, locale, format);
			}

			const type = typeof value;
			if (type === "string") {
				return value as string;
			}

			if (type === "object" && value !== null) {
				let proto = Object.getPrototypeOf(value) as unknown;
				while (proto !== null) {
					const formatter = formatters?.get(proto) ?? controller.formatters.get(proto);
					if (formatter !== undefined) {
						return formatter(value, locale);
					}
					proto = Object.getPrototypeOf(proto);
				}
			}

			const formatter = formatters?.get(type) ?? controller.formatters.get(type);
			if (formatter === undefined) {
				return String(value);
			}
			return formatter(value, locale, format);
		});
	};
}
