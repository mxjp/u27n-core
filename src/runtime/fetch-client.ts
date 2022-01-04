import { LocaleData, U27N } from ".";
import { Locale } from "./locale.js";

export class FetchClient implements U27N.Client {
	#url: string;

	public constructor(url: string = "/locale/[locale].json") {
		this.#url = url;
	}

	public async fetchResources(_controller: U27N, locale: Locale): Promise<void> {
		const url = this.#url.replace(/\[locale\]/g, locale.code);
		const response = await fetch(url);
		if (response.ok) {
			locale.addData(await response.json() as LocaleData);
		} else {
			throw new FetchClient.RequestError(response);
		}
	}
}

export namespace FetchClient {
	export class RequestError extends Error {
		public constructor(public readonly response: Response) {
			super(`${response.status} ${response.statusText}`);
		}
	}
}
