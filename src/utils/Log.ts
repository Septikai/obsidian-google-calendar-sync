// Credits go to SilentVoid13's Templater Plugin: https://github.com/SilentVoid13/Templater

import { Notice } from "obsidian";
import { PluginError } from "./Error";

export function log_update(msg: string): void {
	const notice = new Notice("", 15000);
	notice.noticeEl.innerHTML = `<b>GoogleCalendarSync update</b>:<br/>${msg}`;
}

export function log_error(e: Error | PluginError): void {
	const notice = new Notice("", 8000);
	if (e instanceof PluginError && e.console_msg) {
		notice.noticeEl.innerHTML = `<b>GoogleCalendarSync Error</b>:<br/>${e.message}<br/>Check console for more information`;
		console.error(`GoogleCalendarSync Error:`, e.message, "\n", e.console_msg);
	} else {
		notice.noticeEl.innerHTML = `<b>Templater Error</b>:<br/>${e.message}`;
	}
}
