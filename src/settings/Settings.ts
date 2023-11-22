import {PluginSettingTab, Setting} from "obsidian";
import GoogleCalendarSyncPlugin from "../main";
import {FolderSuggest} from "./suggesters/FolderSuggester";
import {FileSuggest, FileSuggestMode} from "./suggesters/FileSuggester";

export interface Settings {
	directory: string;
	calendar_id: string;
	token_file: string;
	credentials: string;
}

export const DEFAULT_SETTINGS: Partial<Settings> = {
	directory: "/",
	calendar_id: "",
	token_file: "",
	credentials: ""
};

export class SettingTab extends PluginSettingTab {

	constructor(private plugin: GoogleCalendarSyncPlugin) {
		super(plugin.app, plugin);
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Calendar folder location")
			.setDesc("The folder all of your calendar event notes are stored in")
			.addSearch((cb) => {
				new FolderSuggest(cb.inputEl);
				cb.setPlaceholder("Example: folder1/folder2")
					.setValue(this.plugin.settings.directory)
					.onChange(async (new_folder) => {
						this.plugin.settings.directory = new_folder;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Calendar ID")
			.setDesc("Found in Google Calendar settings under \"Integrate calendar\"")
			.addText(text => text
				.setPlaceholder("Calendar ID")
				.setValue(this.plugin.settings.calendar_id)
				.onChange(async (value) => {
					this.plugin.settings.calendar_id = value;
					await this.plugin.saveSettings();
				})
			);

		let credentialsFileLocationDiv = document.createElement("div");
		credentialsFileLocationDiv.innerHTML = "Your <a href=\"https://developers.google.com/calendar/api/quickstart/nodejs\">credentials file from Google</a>";
		let credentialsFileLocationFrag = document.createDocumentFragment();
		credentialsFileLocationFrag.append(credentialsFileLocationDiv);
		new Setting(containerEl)
			.setName("Credentials File Location")
			.setDesc(credentialsFileLocationFrag)
			.addSearch((cb) => {
				new FileSuggest(cb.inputEl, this.plugin, FileSuggestMode.ConfigFiles, "json");
				cb.setPlaceholder("Example: folder1/credentials.json")
					.setValue(this.plugin.settings.token_file)
					.onChange(async (new_file) => {
						this.plugin.settings.token_file = new_file;
						await this.plugin.saveSettings();
					});
			});
	}
}
