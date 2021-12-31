
export class SourceUpdates {
	#source: string;
	#updates: SourceUpdates.Update[] = [];

	public constructor(source: string) {
		this.#source = source;
	}

	public append(update: SourceUpdates.Update): this {
		if (this.#updates.length > 0 && update.start < this.#updates[this.#updates.length - 1].end) {
			throw new Error("updates must be appended in order");
		}
		if (update.start < 0 || update.start > update.end || update.end > this.#source.length) {
			throw new RangeError("update out of range");
		}
		this.#updates.push(update);
		return this;
	}

	public format(): string {
		const source = this.#source;
		const parts: string[] = [];

		let offset = 0;
		for (let i = 0; i < this.#updates.length; i++) {
			const update = this.#updates[i];
			parts.push(source.slice(offset, update.start));
			parts.push(update.text);
			offset = update.end;
		}

		if (offset < source.length) {
			parts.push(source.slice(offset, source.length));
		}

		return parts.join("");
	}
}

export declare namespace SourceUpdates {
	export interface Update {
		start: number;
		end: number;
		text: string;
	}
}
