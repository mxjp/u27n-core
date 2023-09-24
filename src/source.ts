import { DataAdapter } from "./data-adapter.js";
import { FragmentIdGenerator } from "./fragment-id-generator.js";

/**
 * Represents a source file.
 */
export interface Source<F extends Source.Fragment = Source.Fragment> {
	/**
	 * If implemented, this fragment id generator is used by the
	 * {@link Source.UpdateContext.updateId} function instead of the default generator.
	 */
	readonly fragmentIdGenerator?: FragmentIdGenerator;

	/**
	 * Called to create an updated version of this source.
	 *
	 * An update implementation should be omitted, if
	 * it doesn't make sense for the type of source.
	 */
	update?(context: Source.UpdateContext): Source.UpdateResult;

	/**
	 * Get an array of filenames that this source is compiled to.
	 *
	 * If this is not implemented or returns an empty array,
	 * fragment ids from this source are added to the
	 * manifest as global fragments.
	 */
	getOutputFilenames?(): string[];

	/**
	 * Get an array of all fragments in this source.
	 */
	get fragments(): readonly F[];

	/**
	 * Get a map of ids to fragments.
	 *
	 * Note that this may not contain all fragments if there are any duplicate fragment ids.
	 */
	get fragmentMap(): ReadonlyMap<string, F>;
}

export declare namespace Source {
	export interface Fragment {
		/** The id of the fragment or undefined if no id is assigned */
		fragmentId?: string;
		/** The value of the fragment or undefined if the current value is invalid for any reason */
		value: DataAdapter.Value;
		/** False if the fragment is commented out */
		enabled: boolean;
		/** The inclusive start offset */
		start: number;
		/** The exclusive end offset */
		end: number;
	}

	export interface UpdateContext {
		/**
		 * This should be called by the update implementation for each fragment to get a project wide unique id for that fragment.
		 *
		 * @returns The updated id to replace the current id.
		 */
		updateId(fragment: Fragment): string;
	}

	export interface UpdateResult {
		/**
		 * Indicates if the content is modified by this update.
		 *
		 * If this is true, one of {@link content}, {@link textContent} or {@link persist} should be defined.
		 */
		modified: boolean;

		/** A map of all fragment ids to fragment updates (also including fragments that have not been updated) */
		fragments: Map<string, FragmentUpdate>;

		/**
		 * The modified source content.
		 *
		 * This is prioritized over {@link textContent} if implemented.
		 */
		content?: Buffer;

		/**
		 * The modified source content as text.
		 */
		textContent?: string;

		/**
		 * Called to write the modified source to disk.
		 *
		 * This is prioritized over {@link content} and {@link textContent} if implemented.
		 */
		persist?(): Promise<void>;
	}

	export interface FragmentUpdate {
		/** The source value of the fragment */
		value: DataAdapter.Value;
		/** False if the fragment is commented out */
		enabled: boolean;
		/** The old id or undefined if the fragment did not have an id */
		oldFragmentId: string | undefined;
	}
}
