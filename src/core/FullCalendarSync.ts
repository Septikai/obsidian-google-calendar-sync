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
	public eventDb = new Array<FullCalendarEvent>();

	constructor(private plugin: GoogleCalendarSyncPlugin) {

	}

	async setup() {

	}

	public addFullCalendarEventToDb(event: FullCalendarEvent) {
		this.eventDb.push(event);
	}

	public updateFullCalendarEventFile(file: TFile, fm?: object, desc?: string) {
		if (fm !== undefined) {
			this.plugin.app.fileManager.processFrontMatter(file, (f: any) => {
				for (const k in fm) {
					// @ts-ignore
					f[k] = fm[k];
				}
				return f;
			});
		}
		if (desc !== undefined) {
			//
		}
	}

	public parseFullCalendarEvent(file: TFile): FullCalendarEvent | null {
		const matches = CALENDAR_EVENT_REGEX.exec(file.name)
		if (matches) {
			this.plugin.app.fileManager.processFrontMatter(file, (f: any) => {
				f["synced-to-google"] = false;
				return f;
			});
			const name = matches[2].trim().length > 0 ? matches[2].trim() : "Untitled";
			const date = matches[1];
			const fileLink = `obsidian://open?vault=${this.plugin.app.vault.getName()}&file=${file.name.replace(".md", "")}`;
			return {
				"id": "",
				"date": date,
				"summary": name,
				"description": fileLink,
				"link": fileLink
			}
		}
		return null;
	}
}
