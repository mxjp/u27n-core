import { Formatters } from "./interpolation.js";
import { Locale } from "./locale.js";
import { LocaleCode } from "./locale-code.js";

/**
 * A controller that manages the current locale and locale data.
 */
export class U27N {
	readonly #localeFactory: U27N.LocaleFactory;
	readonly #locales: Map<string, Locale>;
	readonly #setLocaleHooks: Set<U27N.SetLocaleHook>;

	#locale: Locale | null = null;

	/**
	 * A set of clients that are used.
	 *
	 * This may be used to add clients to an already created controller.
	 */
	readonly clients: Set<U27N.Client>;

	/**
	 * A map of interpolation formatters that are available for all contexts that use this controller.
	 */
	readonly formatters: Formatters;

	/**
	 * A set of update handlers.
	 *
	 * Update handlers are called when the locale has been changed or when the {@link update} function is called manually.
	 */
	readonly updateHandlers: Set<U27N.UpdateHandler>;

	constructor(options: U27N.Options) {
		this.#localeFactory = options.localeFactory;
		this.#locales = new Map();
		this.#setLocaleHooks = new Set();

		this.clients = new Set(options.clients);
		this.formatters = new Map(options.formatters!);
		this.updateHandlers = new Set();
	}

	/**
	 * Get the current locale.
	 *
	 * @returns The current locale or null if no locale has been set yet.
	 */
	get locale(): Locale | null {
		return this.#locale;
	}

	/**
	 * Fetch resources for the specified locale and then set it as the current locale.
	 *
	 * @param code The locale code.
	 */
	async setLocale(code: string): Promise<void> {
		const locale = this.ensureLocale(code);
		this.#setLocaleHooks.forEach(hook => hook(locale));

		const tasks: Promise<void>[] = [];
		this.clients.forEach(client => {
			tasks.push(client.fetchResources(this, locale));
		});
		const results = await Promise.allSettled(tasks);
		for (let i = 0; i < results.length; i++) {
			const result = results[i];
			if (result.status === "rejected") {
				throw result.reason;
			}
		}

		this.#locale = locale;
		this.update();
	}

	/**
	 * Register a function to be called before when setting the locale, but before fetching resources.
	 *
	 * @returns The function that was registered.
	 */
	registerSetLocaleHook(hook: U27N.SetLocaleHook): U27N.SetLocaleHook {
		this.#setLocaleHooks.add(hook);
		return hook;
	}

	/**
	 * The opposite of {@link registerSetLocaleHook}
	 */
	unregisterSetLocaleHook(hook: U27N.SetLocaleHook): void {
		this.#setLocaleHooks.delete(hook);
	}

	/**
	 * Detect and set a supported locale.
	 *
	 * See {@link U27N.detectLocale} for details.
	 *
	 * @param locales The supported locales to choose from.
	 */
	setLocaleAuto(locales: string[]): Promise<void> {
		if (locales.length === 0) {
			throw new TypeError("at least one locale must be specified");
		}
		const code = U27N.detectLocale(locales) ?? locales[0];
		return this.setLocale(code);
	}

	/**
	 * Create a locale instance and store it in this controller without setting the locale.
	 *
	 * This can be used to manually add resources to a specific locale.
	 */
	ensureLocale(code: string): Locale {
		let locale = this.#locales.get(code);
		if (locale === undefined) {
			locale = this.#localeFactory(this, code);
			this.#locales.set(code, locale);
		}
		return locale;
	}

	/**
	 * Get a locale instance.
	 *
	 * @eturns The locale or undefined if it doesn't exist.
	 */
	getLocale(code: string): Locale | undefined {
		return this.#locales.get(code);
	}

	/**
	 * Call all registered {@link updateHandlers}.
	 */
	update(): void {
		this.updateHandlers.forEach(handler => handler(this));
	}

	/**
	 * Detect the current browser locale respecting the browsers language priority.
	 *
	 * @param locales The supported locales to choose from.
	 * @returns A supported locale or undefined if no supported locale matched any browser locales.
	 */
	static detectLocale(locales: string[]): string | undefined {
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
		/**
		 * Called to fetch resources for the specified locale.
		 *
		 * This may be called repeatedly for the same locale instance.
		 *
		 * To get the locale code, use {@link Locale.code}.
		 */
		fetchResources(controller: U27N, locale: Locale): Promise<void>;
	}

	export interface LocaleFactory {
		/**
		 * Create a new locale instance.
		 */
		(controller: U27N, code: string): Locale;
	}

	export interface Options {
		/**
		 * An array of clients.
		 *
		 * These clients are added to the {@link U27N.clients} set.
		 */
		clients?: Client[];

		/**
		 * A function to create a locale instance.
		 */
		localeFactory: LocaleFactory;

		/**
		 * A map of interpolation formatters that are available for all contexts that use this controller.
		 */
		formatters?: Formatters;
	}

	export interface UpdateHandler {
		/**
		 * @param controller The controller that has been updated.
		 */
		(controller: U27N): void;
	}

	export interface SetLocaleHook {
		/**
		 * @param targetLocale The locale that is about to be set.
		 */
		(targetLocale: Locale): void;
	}
}
