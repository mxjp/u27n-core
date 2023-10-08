import * as fs from "node:fs/promises";
import { join, relative, sep } from "node:path";

import chokidar from "chokidar";
import createMatcher, { Matcher, scan } from "picomatch";

export interface WatchFileOptions {
	cwd: string;
	patterns: string[];
	delay: number;
	onChange: (changes: FileChanges) => Promise<void>;
	onError?: (error: unknown) => void;
}

export interface FileChanges {
	readonly updated: string[];
	readonly removed: string[];
}

export function watchFiles(options: WatchFileOptions): () => Promise<void> {
	const watcher = chokidar.watch(options.patterns, { cwd: options.cwd });

	let ready = false;
	let handling = false;

	const updated = new Set<string>();
	const deleted = new Set<string>();

	let handleChangesTimer: NodeJS.Timeout | null = null;
	function handleChanges() {
		if (handleChangesTimer !== null) {
			clearTimeout(handleChangesTimer);
		}
		handleChangesTimer = setTimeout(() => {
			if (ready && !handling) {
				handling = true;
				void (async () => {
					while (updated.size > 0 || deleted.size > 0) {
						try {
							const changes: FileChanges = {
								updated: Array.from(updated),
								removed: Array.from(deleted),
							};
							updated.clear();
							deleted.clear();
							await options.onChange(changes);
						} catch (error) {
							options.onError?.(error);
						}
					}
					handling = false;
				})();
			}
		}, options.delay);
	}

	watcher.on("add", filename => {
		filename = join(options.cwd, filename);
		updated.add(filename);
		deleted.delete(filename);
		handleChanges();
	});

	watcher.on("change", filename => {
		filename = join(options.cwd, filename);
		updated.add(filename);
		deleted.delete(filename);
		handleChanges();
	});

	watcher.on("unlink", filename => {
		filename = join(options.cwd, filename);
		updated.delete(filename);
		deleted.add(filename);
		handleChanges();
	});

	watcher.on("ready", () => {
		ready = true;
		handleChanges();
	});

	watcher.on("error", error => {
		options.onError?.(error);
	});

	return async () => {
		await watcher.close();
		if (handleChangesTimer !== null) {
			clearTimeout(handleChangesTimer);
		}
	};
}

export interface FindFileOptions {
	cwd: string;
	patterns: string[];
}

export async function findFiles(options: FindFileOptions): Promise<string[]> {
	const matchers: Matcher[] = [];
	let basedirs: string[] = [];
	for (const pattern of options.patterns) {
		matchers.push(createMatcher(pattern));
		const basedir = join(options.cwd, scan(pattern).base);
		if (!basedirs.some(path => isOrContains(path, basedir))) {
			basedirs = basedirs.filter(path => !isOrContains(basedir, path));
			basedirs.push(basedir);
		}
	}

	const files: string[] = [];
	for (const basedir of basedirs) {
		await (async function traverse(path: string): Promise<void> {
			let children: string[];
			try {
				children = await fs.readdir(path);
			} catch (error) {
				if ((error as NodeJS.ErrnoException)?.code !== "ENOTDIR") {
					throw error;
				}
				const rel = relative(options.cwd, path);
				if (matchers.some(matcher => matcher(rel))) {
					files.push(path);
				}
				return;
			}
			for (const child of children) {
				await traverse(join(path, child));
			}
		})(basedir);
	}
	return files;
}

function isOrContains(parent: string, nested: string): boolean {
	return parent === nested || (nested.startsWith(parent) && nested[parent.length] === sep);
}
