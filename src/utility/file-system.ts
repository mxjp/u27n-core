
export interface FileSystem {
	readFile(filename: string): Promise<string>;
	readOptionalFile(filename: string): Promise<string | undefined>;
	writeFile(filename: string, content: string): Promise<void>;
	watchFiles(options: FileSystem.WatchFileOptions): () => Promise<void>;
	findFiles(options: FileSystem.FindFileOptions): Promise<string[]>;
}

export declare namespace FileSystem {
	export interface WatchFileOptions {
		cwd: string;
		patterns: string[];
		onChange: (changes: WatchFileOptions.Changes) => Promise<void>;
		onError?: (error: unknown) => void;
	}

	export namespace WatchFileOptions {
		export interface Changes {
			readonly updated: string[];
			readonly removed: string[];
		}
	}

	export interface FindFileOptions {
		cwd: string;
		patterns: string[];
	}
}
