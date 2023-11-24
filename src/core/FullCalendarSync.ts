import GoogleCalendarSyncPlugin from "../main";
import {TFile} from "obsidian";
import {get_tfiles_from_folder} from "../utils/Utils";

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
		const matches = /^(\d{4}-\d{2}-\d{2})(.*).md/g.exec(name)
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

	public async updateFullCalendarEventFile(plugin: GoogleCalendarSyncPlugin, file: TFile, id: string, fm?: object, desc?: string) {
		// If summary is passed into options, date must also be passed into options or summary wil be ignored
		console.log("updating file");
		let rename: string | null = null;
		let description = "";
		if (fm !== undefined) {
			await this.plugin.app.fileManager.processFrontMatter(file, (f: any) => {
				for (const k in fm) {
					if (k === "summary" && "date" as keyof typeof fm in fm) {
						rename = fm["date" as keyof typeof fm] + " " + fm[k as keyof typeof fm] + ".md";
					}
					else if (k !== "summary") f[k] = fm[k as keyof typeof fm];
				}
				return f;
			});
		}
		if (desc !== undefined) {
			// eslint-disable-next-line @typescript-eslint/no-this-alias
			const that = this;
			description = desc;
			await this.plugin.app.vault.process(file, (f: any) => {
				const matches = /^(obsidian:\/\/open\?vault=.+&file=\d{4}-\d{2}-\d{2}.*)$/gm.exec(desc);
				if (!matches) description = `obsidian://open?vault=${that.plugin.app.vault.getName()}&file=${file.name.replace(".md", "")}` + "\n\n" + description;
				const temp = f.split("---").slice(0, 2);
				temp.push("\n" + description);
				return temp.join("---");
			})
		}
		if (rename !== null) {
			const newPath = file.path.split("/").slice(0, -1);
			newPath.push(rename);
			await this.plugin.app.vault.rename(file, newPath.join("/"))
			// eslint-disable-next-line @typescript-eslint/no-this-alias
			const that = this;
			await this.plugin.app.vault.process(file, (f) => {
				let description = f.split("---").slice(2).join("---").trim();
				const matches = /^(obsidian:\/\/open\?vault=.+&file=\d{4}-\d{2}-\d{2}.*)$/gm.exec(description);

				if (matches !== null) {
					description = description.replace(/^(obsidian:\/\/open\?vault=.+&file=\d{4}-\d{2}-\d{2}.*)$/gm, `obsidian://open?vault=${that.plugin.app.vault.getName()}&file=${(<string> rename).replace(".md", "")}`);
				} else {
					description = `obsidian://open?vault=${that.plugin.app.vault.getName()}&file=${(<string> rename).replace(".md", "")}` + "\n\n" + description;
				}

				const temp = f.split("---").slice(0, 2);
				temp.push("\n" + description);
				return temp.join("---");
			})
		}
		if (desc !== null) this.updateFullCalendarEvent(id, {...fm, description: description})
		else this.updateFullCalendarEvent(id, {...fm})
	}

	public async parseFullCalendarEvent(file: TFile): Promise<FullCalendarEvent | null> {
		const matches = /^(\d{4}-\d{2}-\d{2})(.*).md/g.exec(file.name)
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
				const linkMatches = /^(obsidian:\/\/open\?vault=.+&file=\d{4}-\d{2}-\d{2}.*)$/gm.test(dc);
				if (!linkMatches) desc +=  "\n\n" + dc;
				else desc = dc;
				const temp = f.split("---").slice(0, 2);
				temp.push("\n" + desc);
				return temp.join("---");
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
