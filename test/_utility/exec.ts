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
