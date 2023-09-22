
export interface FileSystem {
	readFile(filename: string): Promise<Buffer>;
	readOptionalFile(filename: string): Promise<Buffer | undefined>;
	writeFile(filename: string, content: Buffer): Promise<void>;
	watchFiles(options: FileSystem.WatchFileOptions): () => Promise<void>;
	findFiles(options: FileSystem.FindFileOptions): Promise<string[]>;
}

export declare namespace FileSystem {
	export interface WatchFileOptions {
		cwd: string;
		patterns: string[];
		delay: number;
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
