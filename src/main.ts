import {Plugin, TAbstractFile, TFile} from 'obsidian';
import {DEFAULT_SETTINGS, Settings, SettingTab} from "./settings/Settings";
import {GoogleCalendarSync} from "./core/GoogleCalendarSync";
import {FullCalendarEvent, FullCalendarSync} from "./core/FullCalendarSync";



export default class GoogleCalendarSyncPlugin extends Plugin {
	public settings: Settings;
	public google_calendar_sync: GoogleCalendarSync;
	public full_calendar_sync: FullCalendarSync;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new SettingTab(this));

		this.google_calendar_sync = new GoogleCalendarSync(this)

		await this.google_calendar_sync.setup();

		this.full_calendar_sync = new FullCalendarSync(this)

		await this.full_calendar_sync.setup();

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
		const event: FullCalendarEvent | null = this.full_calendar_sync.parseFullCalendarEvent(file);
		if (event === null) return;
		this.google_calendar_sync.checkAddCalendarEvent(event, file);
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


