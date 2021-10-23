import { base62encode } from "./utility/base62.js";

export interface FragmentIdGenerator {
	/**
	 * Called to prepare the generator.
	 *
	 * @param fragmentToSources A readonly mapping of currently known fragment ids to sets of source ids that contain these fragments.
	 */
	prepare?(fragmentToSources: ReadonlyMap<string, ReadonlySet<string>>): void;

	/**
	 * Called to generate the next id.
	 *
	 * Subsequent calls must return values that have not been returned before.
	 */
	generate(): string;
}

/**
 * A fragment id generator that yields incrementing base 62 encoded numeric ids.
 */
export class Base62FragmentIdGenerator implements FragmentIdGenerator {
	private _next = 0;

	public generate(): string {
		return base62encode(this._next++);
	}
}
