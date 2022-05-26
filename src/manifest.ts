import { dirname, isAbsolute, join, normalize, relative } from "path";

export interface Manifest {
	/**
	 * The manifest version.
	 *
	 * This number is increased when fields are removed or the format or semantic of existing fields is changed.
	 */
	version: 1;

	/**
	 * Map of locale codes to compiled locale data file ids.
	 */
	locales: Record<string, string>;

	/**
	 * Map of compiled source file ids to source information.
	 */
	files: Record<string, Manifest.FileInfo>;
}

export namespace Manifest {
	export interface FileInfo {
		/**
		 * Array of fragment ids that are used in this source.
		 */
		fragmentIds: string[];
	}

	/**
	 * The manifest filename that should be used by convention.
	 */
	export const NAME = "u27n-manifest.json";

	/**
	 * The file id for global fragments.
	 */
	export const GLOBAL_FILE_ID = "";

	/**
	 * Parse a manifest.
	 *
	 * Older manifest versions are automatically converted to the current version.
	 */
	export function parse(json: string): Manifest {
		const manifest = JSON.parse(json) as Manifest;
		if (manifest.version !== 1) {
			throw new TypeError("unsupported manifest version");
		}
		return manifest;
	}

	/**
	 * Stringify the specified manifest.
	 */
	export function stringify(manifest: Manifest): string {
		return JSON.stringify(manifest);
	}

	/**
	 * Convert an absolute or relative filename to a file id that can be used in a manifest.
	 *
	 * @param manifestFilename The absolute filename of the manifest.
	 * @param filename The absolute or relative filename to convert.
	 */
	export function filenameToFileId(manifestFilename: string, filename: string): string {
		return (isAbsolute(filename) ? relative(dirname(manifestFilename), filename) : normalize(filename)).replace(/\\/g, "/");
	}

	/**
	 * Convert a file id to an absolute filename.
	 *
	 * @param manifestFilename The absolute filename of the manifest.
	 * @param fileId The file id to convert.
	 */
	export function fileIdToFilename(manifestFilename: string, fileId: string): string {
		if (fileId === GLOBAL_FILE_ID) {
			throw new TypeError("The global file id must be handled manually.");
		}
		return join(dirname(manifestFilename), fileId);
	}
}
