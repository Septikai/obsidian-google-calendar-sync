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

		this.full_calendar_sync = new FullCalendarSync(this)

		await this.full_calendar_sync.setup();

		await this.google_calendar_sync.setup();

		this.app.workspace.onLayoutReady( () => {
			this.registerEvent(this.app.vault.on("create", async (file: TAbstractFile) => {
				await this.onFileCreate(file)
			}));
			this.registerEvent(this.app.vault.on("modify", async (file: TAbstractFile) => {
				await this.onFileModify(file)
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
		// 10 Minutes
		this.registerInterval(window.setInterval(async () => await this.updateGoogleCalendarCache(), 1000 * 60 * 10));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private async onFileCreate(file: TAbstractFile) {
		if (file.path.split("/").slice(0, -1).join("/") !== this.settings.directory || !(file instanceof TFile)) return;
		const event: FullCalendarEvent | null = await this.full_calendar_sync.parseFullCalendarEvent(file);
		if (event === null) return;
		this.google_calendar_sync.checkAddCalendarEvent(event, file);
	}

	private async onFileModify(file: TAbstractFile) {
		if (file.path.split("/").slice(0, -1).join("/") !== this.settings.directory) return;
		if (!(file instanceof TFile)) return;
		let event: FullCalendarEvent | undefined;
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const that = this;
		let gId = "";
		await this.app.fileManager.processFrontMatter(<TFile> file, async (f) => {
			gId = f["google-id"];
			event = that.full_calendar_sync.getFullCalendarEventById(gId);
			const fcEvent = await that.full_calendar_sync.parseFullCalendarEvent(file);
			if (fcEvent === null || event === undefined) return f;
			const fileNameData = that.full_calendar_sync.parseFullCalendarEventFileName(file.name);
			if (fcEvent.date !== event.date) {
				if (fileNameData !== null && fcEvent.date !== fileNameData.date) that.full_calendar_sync.updateFullCalendarEvent(gId, {date: fileNameData.date});
				else that.full_calendar_sync.updateFullCalendarEvent(gId, {date: f["date"]})
			}
			if (fcEvent.summary !== event.summary) {
				if (fileNameData !== null && fcEvent.summary !== fileNameData.summary) that.full_calendar_sync.updateFullCalendarEvent(gId, {date: fileNameData.date});
				else that.full_calendar_sync.updateFullCalendarEvent(gId, {summary: event.summary})
			}
			if (event.link == "" || event.link !== fcEvent.link) that.full_calendar_sync.updateFullCalendarEvent(gId, {link: `obsidian://open?vault=${that.app.vault.getName()}&file=${file.name.replace(".md", "")}`});
			return f;
		})
		if (event === undefined) return;
		let desc = event.link;
		await this.app.vault.process(<TFile>file, (f) => {
			const dc = f.split("---").slice(2).join("---").trim();
			// For some reason using that.google_calendar_sync.OBSIDIAN_LINK_REGEX fails to match
			// every time, but this works despite being identical
			const matches = /^(obsidian:\/\/open\?vault=.+&file=\d{4}-\d{2}-\d{2}.*)$/gm.exec(dc);
			if (!matches) desc +=  "\n\n" + dc;
			else desc = dc;
			const arr = f.split("---").slice(0, 2);
			arr.push("\n" + desc);
			f = arr.join("---");
			return f;
		})
		this.full_calendar_sync.updateFullCalendarEvent(gId, {description: desc});
		this.google_calendar_sync.syncFullCalendarEventToGoogle(gId);
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


