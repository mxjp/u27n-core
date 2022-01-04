import { Formatters } from "./interpolation.js";
import { Locale } from "./locale.js";
import { LocaleCode } from "./locale-code.js";

export class U27N {
	readonly #localeFactory: U27N.LocaleFactory;
	readonly #locales: Map<string, Locale>;

	#locale: Locale | null = null;

	public readonly clients: Set<U27N.Client>;
	public readonly formatters: Formatters;
	public readonly updateHandlers: Set<U27N.UpdateHandler>;

	public constructor(options: U27N.Options) {
		this.#localeFactory = options.localeFactory;
		this.#locales = new Map();

		this.clients = new Set(options.clients);
		this.formatters = new Map(options.formatters!);
		this.updateHandlers = new Set();
	}

	public get locale(): Locale | null {
		return this.#locale;
	}

	public async setLocale(code: string, refresh = false): Promise<void> {
		let locale = refresh ? undefined : this.#locales.get(code);
		if (locale === undefined) {
			locale = this.#localeFactory(this, code);
			this.#locales.set(code, locale);

			const tasks: Promise<void>[] = [];
			this.clients.forEach(client => {
				tasks.push(client.fetchResources(this, locale!));
			});
			await Promise.all(tasks);

			this.#locale = locale;
			this.update();
		}
	}

	public setLocaleAuto(locales: string[], update = false): Promise<void> {
		if (locales.length === 0) {
			throw new TypeError("at least one locale must be specified");
		}
		const code = U27N.detectLocale(locales) ?? locales[0];
		return this.setLocale(code, update);
	}

	public update(): void {
		this.updateHandlers.forEach(handler => handler(this));
	}

	public static detectLocale(locales: string[]): string | undefined {
		const localeSet = new Set(locales);
		const localeLangs = new Map(locales.map(locale => ([LocaleCode.parse(locale).language, locale])));

		const langs = navigator.languages;
		for (let i = 0; i < langs.length; i++) {
			if (localeSet.has(langs[i])) {
				return langs[i];
			}
		}

		for (let i = 0; i < langs.length; i++) {
			const locale = localeLangs.get(langs[i]);
			if (locale !== undefined) {
				return locale;
			}
		}
	}
}

export declare namespace U27N {
	export interface Client {
		fetchResources(controller: U27N, locale: Locale): Promise<void>;
	}

	export interface LocaleFactory {
		(controller: U27N, code: string): Locale;
	}

	export interface Options {
		clients?: Client[];
		localeFactory: LocaleFactory;
		formatters?: Formatters;
	}

	export interface UpdateHandler {
		(controller: U27N): void;
	}
}
