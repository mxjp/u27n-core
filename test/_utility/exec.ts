import { ExecutionContext } from "ava";
import { spawn } from "child_process";

export function exec(cwd: string, command: string, args: string[]): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		const proc = spawn(command, args, {
			cwd,
			stdio: "inherit",
			shell: true,
		});
		proc.on("close", (code, signal) => {
			if (code || signal) {
				// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
				reject(new Error(`process exited wrongly: ${code || signal}`));
			} else {
				resolve();
			}
		});
	});
}

export function execStart(t: ExecutionContext, cwd: string, command: string, args: string[]): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		const proc = spawn(command, args, {
			cwd,
			stdio: "inherit",
			shell: true,
		});

		let teardown = false;

		t.teardown(() => {
			return new Promise<void>(resolve => {
				teardown = true;
				if (proc.killed) {
					resolve();
				} else {
					proc.on("exit", () => {
						resolve();
					});
					proc.kill();
				}
			});
		});

		proc.once("error", reject);
		proc.on("spawn", () => {
			proc.off("error", reject);
			proc.on("error", error => {
				t.fail(error.stack ?? error.message);
			});
			resolve();
		});
		proc.on("exit", (code, signal) => {
			if (!teardown) {
				t.fail(`Process exited wrongly: ${code ?? signal}`);
			}
		});
	});
}
