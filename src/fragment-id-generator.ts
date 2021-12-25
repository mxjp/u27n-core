import { base62encode } from "./utility/base62.js";

export interface FragmentIdGenerator {
	/**
	 * Called to generate the next id.
	 *
	 * Subsequent calls must return values that have not been returned before.
	 *
	 * @param fragmentToSources A readonly mapping of currently known fragment ids to sets of source ids that contain these fragments.
	 */
	generate(fragmentToSources: ReadonlyMap<string, ReadonlySet<string>>): string;
}

/**
 * A fragment id generator that yields incrementing base 62 encoded numeric ids.
 */
export class Base62FragmentIdGenerator implements FragmentIdGenerator {
	#next = 0;

	public generate(): string {
		return base62encode(this.#next++);
	}
}
