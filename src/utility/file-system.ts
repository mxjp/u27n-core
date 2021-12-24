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
