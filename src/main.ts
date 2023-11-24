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
			this.registerEvent(this.app.vault.on("rename", async (file: TAbstractFile) => {
				await this.onFileRename(file)
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
		await this.google_calendar_sync.checkAddCalendarEvent(event, file);
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
			const matches = /^(obsidian:\/\/open\?vault=.+&file=\d{4}-\d{2}-\d{2}.*)$/gm.exec(dc);
			if (!matches) desc +=  "\n\n" + dc;
			else desc = dc;
			const temp = f.split("---").slice(0, 2);
			temp.push("\n" + desc);
			return temp.join("---");
		})
		this.full_calendar_sync.updateFullCalendarEvent(gId, {description: desc});
		this.google_calendar_sync.syncFullCalendarEventToGoogle(gId);
	}

	private async onFileRename(file: TAbstractFile) {
		if (file.path.split("/").slice(0, -1).join("/") !== this.settings.directory) return;
		if (!(file instanceof TFile)) return;
		const newEvent = await this.full_calendar_sync.parseFullCalendarEvent(file)
		if (newEvent !== null) {
			// Update the Google file to match this one
			const googleEvent = this.google_calendar_sync.getGoogleCalendarEventById(newEvent.id);
			if (googleEvent === undefined) {
				console.log(this.google_calendar_sync.eventDb);
				console.error(`GoogleCalendarSync Error Renaming Event: Error 1 attempting to rename event ${newEvent.id}`);
				return;
			}
			googleEvent.summary = newEvent.summary;
			googleEvent.date = newEvent.date;
			const newPath = file.path.split("/").slice(0, -1);
			newPath.push(newEvent.date + " " + newEvent.summary);
			// eslint-disable-next-line @typescript-eslint/no-this-alias
			const that = this;
			let description = "";
			await this.app.vault.process(file, (f) => {
				description = f.split("---").slice(2).join("---").trim();
				const matches = /^(obsidian:\/\/open\?vault=.+&file=\d{4}-\d{2}-\d{2}.*)$/gm.exec(description);

				if (matches !== null) {
					description = description.replace(/^(obsidian:\/\/open\?vault=.+&file=\d{4}-\d{2}-\d{2}.*)$/gm, `obsidian://open?vault=${that.app.vault.getName()}&file=${(newEvent.date + " " + newEvent.summary).replace(".md", "")}`);
				} else {
					description = `obsidian://open?vault=${that.app.vault.getName()}&file=${(newEvent.date + " " + newEvent.summary).replace(".md", "")}` + "\n\n" + description;
				}

				const temp = f.split("---").slice(0, 2);
				temp.push("\n" + description);
				return temp.join("---");
			});
			this.full_calendar_sync.updateFullCalendarEvent(newEvent.id, {...newEvent, description: description})

			this.google_calendar_sync.updateCalendarEvent(newEvent.id, googleEvent);
		} else {
			// Reset this file to match the Google one
			let id = "";
			await this.app.fileManager.processFrontMatter(file, (f: any) => {
				id = f["id"];
				return f;
			})
			const googleEvent = this.google_calendar_sync.getGoogleCalendarEventById(id);
			if (googleEvent === undefined) {
				console.error(`GoogleCalendarSync Error Renaming Event: Error 2 attempting to rename event ${id}`);
				return;
			}
			await this.full_calendar_sync.updateFullCalendarEventFile(this, file, id, {
				summary: googleEvent.summary, date: googleEvent.date, link: googleEvent.link
			}, googleEvent.description);
		}
	}

	private onFileDelete(file: TAbstractFile) {
		if (file.path.split("/").slice(0, -1).join("/") !== this.settings.directory) return;
	}

	private async updateGoogleCalendarCache() {
		await this.google_calendar_sync.fetchGoogleCalendarEvents();
	}
}


