// Credits go to SilentVoid13's Templater Plugin: https://github.com/SilentVoid13/Templater

import {log_error} from "./Log";

export class PluginError extends Error {
	constructor(msg: string, public console_msg?: string) {
		super(msg);
		this.name = this.constructor.name;
		Error.captureStackTrace(this, this.constructor);
	}
}

export function errorWrapperSync<T>(fn: () => T, msg: string): T {
	try {
		return fn();
	} catch (e) {
		log_error(new PluginError(msg, e.message));
		return null as unknown as T;
	}
}
