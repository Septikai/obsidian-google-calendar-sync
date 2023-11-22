import {normalizePath, TAbstractFile, TFile, TFolder, Vault} from "obsidian";
import {PluginError} from "./Error";
import GoogleCalendarSyncPlugin from "../main";


/**
 * Credits go to SilentVoid13's Templater Plugin: https://github.com/SilentVoid13/Templater
 */
export function resolve_tfolder(folder_str: string, plugin: GoogleCalendarSyncPlugin): TFolder {
	folder_str = normalizePath(folder_str);
	const folder = plugin.app.vault.getAbstractFileByPath(folder_str);
	if (!folder) {
		throw new PluginError(`Folder "${folder_str}" doesn't exist`);
	}
	if (!(folder instanceof TFolder)) {
		throw new PluginError(`${folder_str} is a file, not a folder`);
	}

	return folder;
}

/**
 * Credits go to SilentVoid13's Templater Plugin: https://github.com/SilentVoid13/Templater
 */
export function get_tfiles_from_folder(folder_str: string, plugin: GoogleCalendarSyncPlugin): Array<TFile> {
	const folder = resolve_tfolder(folder_str, plugin);

	const files: Array<TFile> = [];
	Vault.recurseChildren(folder, (file: TAbstractFile) => {
		if (file instanceof TFile) {
			files.push(file);
		}
	});

	files.sort((a, b) => {
		return a.basename.localeCompare(b.basename);
	});

	return files;
}
