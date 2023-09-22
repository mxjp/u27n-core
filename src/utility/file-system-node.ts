import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { clearTimeout, setTimeout } from "node:timers";

import chokidar from "chokidar";
import createMatcher, { Matcher, scan } from "picomatch";

import { FileSystem } from "./file-system.js";

function isOrContains(parent: string, nested: string): boolean {
	return parent === nested || (nested.startsWith(parent) && nested[parent.length] === sep);
}

export class NodeFileSystem implements FileSystem {
	async readFile(filename: string): Promise<Buffer> {
		return readFile(resolve(filename));
	}

	async readOptionalFile(filename: string): Promise<Buffer | undefined> {
		filename = resolve(filename);
		try {
			return await readFile(filename);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") {
				return undefined;
			}
			throw error;
		}
	}

	async writeFile(filename: string, content: Buffer): Promise<void> {
		await mkdir(dirname(filename), { recursive: true });
		await writeFile(filename, content);
	}

	watchFiles(options: FileSystem.WatchFileOptions): () => Promise<void> {
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
								const changes: FileSystem.WatchFileOptions.Changes = {
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

	async findFiles(options: FileSystem.FindFileOptions): Promise<string[]> {
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
					children = await readdir(path);
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
}
