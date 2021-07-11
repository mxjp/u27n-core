import type { Data } from "./data.js";
import { binarySearchIndex } from "./utility/binary-search.js";

export class Source {
	public readonly content: string;

	private _lineMap: number[] | undefined = undefined;
	private _fragments: Source.Fragment[] | undefined = undefined;

	public constructor(content: string) {
		this.content = content;
	}

	/**
	 * Called to parse all fragments in this source.
	 */
	protected parse?(): Source.Fragment[];

	/**
	 * Called to create an updated version of this source.
	 */
	public update?(context: Source.UpdateContext): Source.UpdateResult;

	/** An array of all fragments in this source */
	public get fragments(): Source.Fragment[] {
		if (this._fragments === undefined) {
			this._fragments = this.parse ? this.parse() : [];
		}
		return this._fragments;
	}

	/**
	 * An array of inclusive indices where each line starts.
	 *
	 * The value at each index represents the offset of the first character of that line. Line feeds are interpreted as part of the previous line.
	 */
	public get lineMap(): number[] {
		if (this._lineMap === undefined) {
			const map: number[] = [0];
			let offset = -1;
			while ((offset = this.content.indexOf("\n", offset += 1)) !== -1) {
				map.push(offset + 1);
			}
			this._lineMap = map;
		}
		return this._lineMap;
	}

	/**
	 * Convert a source location to an offset.
	 *
	 * @returns The offset of the character that the specified location points to or undefined if the location does not exist.
	 */
	public locationToOffset(location: Source.Location): number | undefined {
		const { lineMap, content } = this;
		if (location.line < 0 || location.column < 0 || location.line >= lineMap.length) {
			return undefined;
		}
		const start = lineMap[location.line];
		const length = ((location.line + 1 < lineMap.length) ? lineMap[location.line + 1] : content.length) - start;
		if (location.column >= length) {
			return undefined;
		}
		return start + location.column;
	}

	/**
	 * Convert a source offset to a location.
	 *
	 * @returns The location of the character that is specified by the offset or undefined if the offset does not exist.
	 */
	public offsetToLocation(offset: number): Source.Location | undefined {
		const { lineMap, content } = this;
		const line = binarySearchIndex(lineMap, (start, line) => {
			const end = line === lineMap.length - 1 ? content.length : lineMap[line + 1];
			return offset < start ? -1 : (offset >= end ? 1 : 0);
		});
		return line === undefined
			? undefined
			: { line, column: offset - lineMap[line] };
	}
}

export declare namespace Source {
	export interface Fragment {
		/** The id of the fragment or undefined if no id is assigned */
		id?: string;
		/** The value of the fragment or undefined if the current value is invalid for any reason */
		value?: Data.Value;
		/** The inclusive start offset */
		start: number;
		/** The exclusive end offset */
		end: number;
	}

	export interface Location {
		/** The line index */
		line: number;
		/** The column index */
		column: number;
	}

	export interface UpdateContext {
		/**
		 * This should be called by the update implementation for each fragment to get a project wide unique id for that fragment.
		 *
		 * @param currentId The id that is currently assigned to the fragment or undefined if the fragment has no id yet
		 *
		 * @returns The updated id to replace the current id
		 */
		updateId(currentId?: string): string;
	}

	export interface UpdateResult {
		/** True if the source content has been modified */
		modified: boolean;
		/** The update source content */
		content: string;
		/** A map of all ids to fragments */
		fragments: Map<string, UpdateResult.Fragment>;
	}

	export namespace UpdateResult {
		export interface Fragment {
			/** The source value of the fragment */
			value: Data.Value;
			/** The old id or undefined if the fragment did not have an id */
			oldId: string | undefined;
		}
	}
}
