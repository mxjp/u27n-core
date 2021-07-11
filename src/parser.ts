import type { Source } from "./source.js";

export interface Parser {
	/**
	 * Try to create a source from the specified file.
	 *
	 * @param filename The absolute filename.
	 * @param content The content of the file.
	 *
	 * @returns A source instance or undefined if this parser is not suitable for handling the specified file type.
	 */
	createSource(filename: string, content: string): Source | undefined | void;
}
