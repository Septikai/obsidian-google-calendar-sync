import GoogleCalendarSyncPlugin from "../main";
import {TFile} from "obsidian";

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

	public updateFullCalendarEventFile(file: TFile, fm?: object, desc?: string) {
		if (fm !== undefined) {
			this.plugin.app.fileManager.processFrontMatter(file, (f: any) => {
				for (const k in fm) {
					f[k] = fm[k as keyof typeof fm];
				}
				return f;
			});
		}
		if (desc !== undefined) {
			const matches = CALENDAR_EVENT_REGEX.exec(desc);
			// eslint-disable-next-line @typescript-eslint/no-this-alias
			const that = this;
			this.plugin.app.vault.process(file, (f: any) => {
				let fList = f.split("---");
				let description = fList.slice(2).join("---");
				description = desc;
				if (!matches) description += `obsidian://open?vault=${that.plugin.app.vault.getName()}&file=${file.name.replace(".md", "")}`;
				fList = fList.slice(0, 2);
				fList.push(description);
				return fList.join("---");
			})
		}
	}

	public parseFullCalendarEvent(file: TFile): FullCalendarEvent | null {
		const matches = CALENDAR_EVENT_REGEX.exec(file.name)
		if (matches) {
			let id = "";
			this.plugin.app.fileManager.processFrontMatter(file, (f: any) => {
				if ("google-id" in f) id = f["google-id"];
				return f;
			});
			const name = matches[2].trim().length > 0 ? matches[2].trim() : "Untitled";
			const date = matches[1];
			const fileLink = `obsidian://open?vault=${this.plugin.app.vault.getName()}&file=${file.name.replace(".md", "")}`;
			return {
				"id": id,
				"date": date,
				"summary": name,
				"description": "\n" + fileLink,
				"link": fileLink
			}
		}
		return null;
	}
}
