
/**
 * Utility for replacing multiple parts in a large text source.
 */
export class TextReplacements {
	#content: string;
	#replacements: TextReplacements.Replacement[] = [];

	constructor(content: string) {
		this.#content = content;
	}

	/**
	 * Append a replacement.
	 *
	 * Replacements must be appended in order and must not overlap.
	 */
	replace(update: TextReplacements.Replacement): this {
		if (this.#replacements.length > 0 && update.start < this.#replacements[this.#replacements.length - 1].end) {
			throw new Error("replacements must be added in order");
		}
		if (update.start < 0 || update.start > update.end || update.end > this.#content.length) {
			throw new RangeError("replacement is out of range");
		}
		this.#replacements.push(update);
		return this;
	}

	/**
	 * Get the formatted content with all replacements applied.
	 */
	format(): string {
		const source = this.#content;
		const parts: string[] = [];

		let offset = 0;
		for (let i = 0; i < this.#replacements.length; i++) {
			const update = this.#replacements[i];
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

export declare namespace TextReplacements {
	export interface Replacement {
		/**
		 * The inclusive start offset where to apply the replacement.
		 */
		start: number;

		/**
		 * The exclusive end offset where to apply the replacement.
		 */
		end: number;

		/**
		 * The text to replace with.
		 */
		text: string;
	}
}
