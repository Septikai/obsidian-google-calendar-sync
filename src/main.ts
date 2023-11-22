import {Plugin, TAbstractFile, TFile} from 'obsidian';
import {DEFAULT_SETTINGS, Settings, SettingTab} from "./settings/Settings";
import {GoogleCalendarSync} from "./core/GoogleCalendarSync";

const CALENDAR_EVENT_REGEX = /^(\d{4}-\d{2}-\d{2})(.*).md/g;

export default class GoogleCalendarSyncPlugin extends Plugin {
	public settings: Settings;
	public google_calendar_sync: GoogleCalendarSync;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new SettingTab(this));

		this.google_calendar_sync = new GoogleCalendarSync(this)

		await this.google_calendar_sync.setup();

		this.app.workspace.onLayoutReady(() => {
			this.registerEvent(this.app.vault.on("create", (file: TAbstractFile) => {
				this.onFileCreate(file)
			}));
			this.registerEvent(this.app.vault.on("modify", (file: TAbstractFile) => {
				this.onFileModify(file)
			}));
			this.registerEvent(this.app.vault.on("rename", (file: TAbstractFile) => {
				this.onFileRename(file)
			}));
			this.registerEvent(this.app.vault.on("delete", (file: TAbstractFile) => {
				this.onFileDelete(file)
			}));
		})

		this.addCommand({
			id: "refresh-google-event-db",
			name: "Refresh Google Calendar Events",
			callback: async () => {
				await this.updateGoogleCalendarCache();
			}
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		// 30 Minutes
		this.registerInterval(window.setInterval(async () => await this.updateGoogleCalendarCache(), 1000 * 60 * 30));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private onFileCreate(file: TAbstractFile) {
		if (file.path.split("/").slice(0, -1).join("/") !== this.settings.directory || !(file instanceof TFile)) return;
		let matches = CALENDAR_EVENT_REGEX.exec(file.name)
		if (matches) {
			this.app.fileManager.processFrontMatter(file, (f) => {
				f["synced-to-google"] = false;
				return f;
			});
			let name = matches[2].trim().length > 0 ? matches[2].trim() : "Untitled";
			let date = matches[1];
			let fileLink = `obsidian://open?vault=${this.app.vault.getName()}&file=${file.name.replace(".md", "")}`;
			this.google_calendar_sync.checkAddCalendarEvent(name, date, fileLink, file);
		}
	}

	private onFileModify(file: TAbstractFile) {
		if (file.path.split("/").slice(0, -1).join("/") !== this.settings.directory) return;
		if (!(file instanceof TFile)) return;
		this.app.vault.process(<TFile> file, (f) => {
			return f;
		})
	}

	private onFileRename(file: TAbstractFile) {
		if (file.path.split("/").slice(0, -1).join("/") !== this.settings.directory) return;
	}

	private onFileDelete(file: TAbstractFile) {
		if (file.path.split("/").slice(0, -1).join("/") !== this.settings.directory) return;
	}

	private async updateGoogleCalendarCache() {
		await this.google_calendar_sync.fetchGoogleCalendarEvents();
	}
}


