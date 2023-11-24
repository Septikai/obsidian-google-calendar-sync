import GoogleCalendarSyncPlugin from "../main";
import {TFile} from "obsidian";
import {get_tfiles_from_folder} from "../utils/Utils";

const CALENDAR_EVENT_REGEX = /^(\d{4}-\d{2}-\d{2})(.*).md/g;

export interface FullCalendarEvent {
	id: string;
	date: string;
	summary: string;
	description: string;
	link: string;
}

export class FullCalendarSync {
	private eventDb = new Array<FullCalendarEvent>();

	constructor(private plugin: GoogleCalendarSyncPlugin) {

	}

	async setup() {
		const files = get_tfiles_from_folder(this.plugin.settings.directory, this.plugin);
		for (const file of files) {
			const event = await this.parseFullCalendarEvent(<TFile> file);
			if (event === null) continue;
			this.addFullCalendarEventToDb(event);
		}
	}

	public async getFullCalendarFileFromId(id: string): Promise<TFile | undefined> {
		const files = get_tfiles_from_folder(this.plugin.settings.directory, this.plugin);
		let found = false;
		for (const file of files) {
			await this.plugin.app.fileManager.processFrontMatter(file, (fm: any) => {
				if ("google-id" in fm && fm["google-id"] === id) found = true;
				return fm;
			})
			if (found)  return file;
		}
		return undefined;
	}

	public parseFullCalendarEventFileName(name: string) {
		const matches = CALENDAR_EVENT_REGEX.exec(name)
		if (!matches) return null;
		const summary = matches[2].trim().length > 0 ? matches[2].trim() : "Untitled";
		const date = matches[1];
		return {summary: summary, date: date};
	}
	
	public updateFullCalendarEvent(id: string, options: object) {
		const event = this.getFullCalendarEventById(id);
		if (event === undefined) return;
		for (const k in options) {
			event[k as keyof typeof event] = options[k as keyof typeof options];
		}
	}

	public getFullCalendarEventById(id: string): FullCalendarEvent | undefined {
		return this.eventDb.find((e) => e.id === id);
	}

	public addFullCalendarEventToDb(event: FullCalendarEvent) {
		this.eventDb.push(event);
	}

	public updateFullCalendarEventFile(plugin: GoogleCalendarSyncPlugin, file: TFile, fm?: object, desc?: string) {
		if (fm !== undefined) {
			this.plugin.app.fileManager.processFrontMatter(file, (f: any) => {
				for (const k in fm) {
					f[k] = fm[k as keyof typeof fm];
				}
				return f;
			});
		}
		if (desc !== undefined) {
			let matches = plugin.google_calendar_sync.OBSIDIAN_LINK_REGEX.exec(desc);
			// eslint-disable-next-line @typescript-eslint/no-this-alias
			const that = this;
			this.plugin.app.vault.process(file, (f: any) => {
				matches = plugin.google_calendar_sync.OBSIDIAN_LINK_REGEX.exec(desc);
				let description = desc;
				if (!matches) description = `obsidian://open?vault=${that.plugin.app.vault.getName()}&file=${file.name.replace(".md", "")}` + "\n\n" + description;
				let fList = f.split("---");
				fList = fList.slice(0, 2);
				fList.push("\n\n" + description);
				return fList.join("---");
			})
		}
	}

	public async parseFullCalendarEvent(file: TFile): Promise<FullCalendarEvent | null> {
		const matches = CALENDAR_EVENT_REGEX.exec(file.name)
		if (matches) {
			let id = "";
			await this.plugin.app.fileManager.processFrontMatter(file, (f: any) => {
				if ("google-id" in f) id = f["google-id"];
				return f;
			});
			const fileLink = `obsidian://open?vault=${this.plugin.app.vault.getName()}&file=${file.name.replace(".md", "")}`;
			let desc = fileLink;
			await this.plugin.app.vault.process(file, (f: string) => {
				const dc = f.split("---").slice(2).join("---").trim();
				// For some reason using that.google_calendar_sync.OBSIDIAN_LINK_REGEX where
				// `const that = this` fails to match every time, but this works despite being identical
				const linkMatches = /^(obsidian:\/\/open\?vault=.+&file=\d{4}-\d{2}-\d{2}.*)$/gm.test(dc);
				if (!linkMatches) desc +=  "\n\n" + dc;
				else desc = dc;
				const arr = f.split("---").slice(0, 2);
				arr.push("\n" + desc);
				f = arr.join("---");
				return f;
			})
			const name = matches[2].trim().length > 0 ? matches[2].trim() : "Untitled";
			const date = matches[1];
			return {
				"id": id,
				"date": date,
				"summary": name,
				"description": desc,
				"link": fileLink
			}
		}
		return null;
	}
}
