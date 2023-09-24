import { isAbsolute, join, normalize, relative } from "node:path";

/**
 * Convert an absolute or relative filename to a unique identifier for that source file within the project.
 *
 * @param rootDir The absolute path of the project root directory.
 * @param filename The absolute or relative filename of the source.
 */
export function filenameToSourceId(rootDir: string, filename: string): string {
	return (isAbsolute(filename) ? relative(rootDir, filename) : normalize(filename)).replace(/\\/g, "/");
}

/**
 * Convert a source id back to an absolute filename.
 *
 * @param rootDir The absolute path of the project root directory.
 * @param sourceId The source id.
 */
export function sourceIdToFilename(rootDir: string, sourceId: string): string {
	return join(rootDir, sourceId);
}
