import { ExecutionContext } from "ava";
import { spawn } from "child_process";

export function exec(t: ExecutionContext, cwd: string, command: string, args: string[], options: ExecOptions = {}): Promise<ExecResult> {
	return new Promise<ExecResult>((resolve, reject) => {
		const output: Buffer[] = [];
		const expectStatus = options.expectStatus ?? 0;

		const proc = spawn(command, args, {
			cwd,
			stdio: ["ignore", "pipe", "pipe"],
			shell: false,
		});

		proc.stdout!.on("data", (chunk: Buffer) => output.push(chunk));
		proc.stderr!.on("data", (chunk: Buffer) => output.push(chunk));

		proc.on("close", (code, signal) => {
			const status = code ?? signal;
			if (status === expectStatus) {
				resolve({
					output: Buffer.concat(output).toString("utf-8"),
				});
			} else {
				t.fail(Buffer.concat(output).toString("utf-8"));
				reject();
			}
		});
	});
}

export interface ExecOptions {
	expectStatus?: number | NodeJS.Signals;
}

export interface ExecResult {
	output: string;
}

export interface ExecStatus {
	output: string;
	kill(): Promise<void>;
}

export function execStart(t: ExecutionContext, cwd: string, command: string, args: string[]): Promise<ExecStatus> {
	return new Promise<ExecStatus>((resolve, reject) => {
		let output = "";

		const proc = spawn(command, args, {
			cwd,
			stdio: ["ignore", "pipe", "pipe"],
			shell: false,
		});

		proc.stdout!.setEncoding("utf-8");
		proc.stdout!.on("data", chunk => output += chunk);
		proc.stderr!.setEncoding("utf-8");
		proc.stderr!.on("data", chunk => output += chunk);

		let teardown = false;

		proc.once("error", reject);
		proc.on("spawn", () => {
			proc.off("error", reject);
			proc.on("error", error => {
				t.fail(error.stack ?? error.message);
			});
			resolve({
				get output() {
					return output;
				},
				set output(value) {
					output = value;
				},
				kill() {
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
				},
			});
		});
		proc.on("exit", (code, signal) => {
			if (!teardown) {
				t.fail(`Process exited wrongly: ${code ?? signal}`);
			}
		});
	});
}
