/* eslint-disable @typescript-eslint/no-explicit-any */
import { CbMacro, ExecutionContext } from "ava";

type MacroArgs<T extends unknown[]> = T extends [ExecutionContext, ...infer A] ? A : never;

export function setMacroTitleFn<T extends unknown[]>(
	macro: (...args: T) => any,
	getTitle: (title: string | undefined, ...args: MacroArgs<T>) => string,
): void {
	(macro as unknown as CbMacro<any>).title = getTitle;
}

export function setMacroTitle(macro: (...args: any[]) => any, prefix: string): void {
	(macro as unknown as CbMacro<any>).title = title => `${prefix}: ${title}`;
}
