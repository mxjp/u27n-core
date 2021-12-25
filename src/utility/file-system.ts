import chokidar from "chokidar";
import { readdir } from "fs/promises";
import { join, relative, sep } from "path";
import createMatcher, { Matcher, scan } from "picomatch";

function isOrContains(parent: string, nested: string): boolean {
	return parent === nested || (nested.startsWith(parent) && nested[parent.length] === sep);
}

export async function findFiles(cwd: string, patterns: string[]): Promise<string[]> {
	const matchers: Matcher[] = [];
	let basedirs: string[] = [];
	for (const pattern of patterns) {
		matchers.push(createMatcher(pattern));
		const basedir = join(cwd, scan(pattern).base);
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
				children = await readdir(path);
			} catch (error) {
				if ((error as NodeJS.ErrnoException)?.code !== "ENOTDIR") {
					throw error;
				}
				const rel = relative(cwd, path);
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

export function watchFiles(options: WatchFileOptions): chokidar.FSWatcher {
	const watcher = chokidar.watch(options.patterns, { cwd: options.cwd });

	let ready = false;
	let handling = false;

	const updated = new Set<string>();
	const deleted = new Set<string>();

	function handleChanges() {
		if (ready && !handling) {
			handling = true;
			void (async () => {
				while (updated.size > 0 || deleted.size > 0) {
					try {
						const changes: WatchFileOptions.Changes = {
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

	return watcher;
}

export interface WatchFileOptions {
	cwd: string;
	patterns: string[];
	onChange: (changes: WatchFileOptions.Changes) => Promise<void>;
	onError?: (error: unknown) => void;
}

export declare namespace WatchFileOptions {
	export interface Changes {
		readonly updated: string[];
		readonly removed: string[];
	}
}
