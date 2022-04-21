import chokidar from "chokidar";
import { access, mkdir, readdir, readFile, writeFile } from "fs/promises";
import { dirname, join, relative, resolve, sep } from "path";
import createMatcher, { Matcher, scan } from "picomatch";
import { clearTimeout, setTimeout } from "timers";

import { FileSystem } from "./file-system.js";

function isOrContains(parent: string, nested: string): boolean {
	return parent === nested || (nested.startsWith(parent) && nested[parent.length] === sep);
}

export class NodeFileSystem implements FileSystem {
	readonly #overwrites = new Map<string, string>();
	readonly #overwriteHandlers = new Set<(filename: string) => void>();

	public async overwrite(filename: string, content: string | null): Promise<void> {
		filename = resolve(filename);
		if (content === null) {
			try {
				this.#overwrites.delete(filename);

				await access(filename);
				this.#overwriteHandlers.forEach(handler => handler(filename));
			// eslint-disable-next-line no-empty
			} catch {}
		} else {
			try {
				this.#overwrites.set(filename, content);

				const realContent = await readFile(filename, "utf-8");
				if (realContent !== content) {
					this.#overwriteHandlers.forEach(handler => handler(filename));
				}
			// eslint-disable-next-line no-empty
			} catch {}
		}
	}

	public async readFile(filename: string): Promise<string> {
		filename = resolve(filename);
		return this.#overwrites.get(filename) ?? readFile(filename, "utf-8");
	}

	public async readOptionalFile(filename: string): Promise<string | undefined> {
		filename = resolve(filename);
		try {
			return this.#overwrites.get(filename) ?? await readFile(filename, "utf-8");
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") {
				return undefined;
			}
			throw error;
		}
	}

	public async writeFile(filename: string, content: string): Promise<void> {
		await mkdir(dirname(filename), { recursive: true });
		await writeFile(filename, content, "utf-8");
	}

	public watchFiles(options: FileSystem.WatchFileOptions): () => Promise<void> {
		const watcher = chokidar.watch(options.patterns, { cwd: options.cwd });

		let ready = false;
		let handling = false;

		const updated = new Set<string>();
		const deleted = new Set<string>();

		let handleChangesTimer: NodeJS.Timer | null = null;
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

		const overwriteHandler = (filename: string) => {
			updated.add(filename);
			handleChanges();
		};
		this.#overwriteHandlers.add(overwriteHandler);

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
			this.#overwriteHandlers.delete(overwriteHandler);
			await watcher.close();
			if (handleChangesTimer !== null) {
				clearTimeout(handleChangesTimer);
			}
		};
	}

	public async findFiles(options: FileSystem.FindFileOptions): Promise<string[]> {
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
