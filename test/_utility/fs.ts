import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import { ExecutionContext } from "ava";

import { Source } from "../../src/source.js";
import { sourceIdToFilename } from "../../src/source-id.js";
import { unindent } from "./unindent.js";

const packageRoot = resolve(__dirname, "../../..");
const moduleRoot = join(packageRoot, "test_out");
const testDataRoot = resolve(packageRoot, "test_data");

export async function createTempDir(moduleFilename: string, t: ExecutionContext): Promise<string> {
	moduleFilename = relative(moduleRoot, moduleFilename)
		.replace(/\.js$/g, "")
		.replace(/[^a-z0-9]+/ig, "-");

	const title = t.title
		.replace(/[^a-z0-9]+/ig, "-")
		.replace(/^-+|-+$/g, "");

	const name = `${moduleFilename}.${title}`;
	const dirname = join(testDataRoot, name);
	await rm(dirname, { recursive: true, force: true });
	await mkdir(dirname, { recursive: true });
	return dirname;
}

export async function createFsLayout(moduleFilename: string, t: ExecutionContext, content: FsLayout): Promise<string> {
	const dirname = await createTempDir(moduleFilename, t);
	await (async function write(filename: string, content: string | FsLayout) {
		if (typeof content === "string") {
			await writeFile(filename, unindent(content));
		} else {
			await mkdir(filename, { recursive: true });
			for (const name in content) {
				await write(join(filename, name), content[name]);
			}
		}
	})(dirname, content);
	return dirname;
}

export async function verifyFsLayout(t: ExecutionContext, dirname: string, content: FsLayout): Promise<void> {
	await (async function verify(filename: string, content: string | FsLayout) {
		if (typeof content === "string") {
			t.is(await readFile(filename, "utf-8"), content);
		} else {
			for (const name in content) {
				await verify(join(filename, name), content[name]);
			}
		}
	})(dirname, content);
}

export async function persistSourceUpdates(dirname: string, modifiedSources: Map<string, Source.PersistUpdateCallback>): Promise<void> {
	for (const [sourceId, persist] of modifiedSources) {
		const filename = sourceIdToFilename(dirname, sourceId);
		await persist(filename);
	}
}

export async function verifySourceUpdates(moduleFilename: string, t: ExecutionContext, modifiedSources: Map<string, Source.PersistUpdateCallback>, content: FsLayout): Promise<void> {
	const cwd = await createTempDir(moduleFilename, t);
	await persistSourceUpdates(cwd, modifiedSources);
	await verifyFsLayout(t, cwd, content);
}

export interface FsLayout {
	[key: string]: string | FsLayout;
}
