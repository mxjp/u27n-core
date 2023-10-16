import { LineMap } from "@mpt/line-map";

import { Source } from "./source.js";
import { SourceBase } from "./source-base.js";

/**
 * Base class for sources that contain text content.
 */
export class TextSource<F extends Source.Fragment = Source.Fragment> extends SourceBase<F> {
	readonly content: string;

	#lineMap: LineMap | undefined = undefined;

	constructor(content: string) {
		super();
		this.content = content;
	}

	/**
	 * A line map for this source that can be used
	 * for converting between line/character positions and offsets.
	 */
	get lineMap(): LineMap {
		if (this.#lineMap === undefined) {
			this.#lineMap = new LineMap(this.content);
		}
		return this.#lineMap;
	}
}
