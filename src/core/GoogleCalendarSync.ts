import GoogleCalendarSyncPlugin from "../main";
import * as path from "path";
import {promises as fs} from "fs";
import {authenticate} from "@google-cloud/local-auth";
import {calendar_v3, google} from "googleapis"
import {OAuth2Client} from "google-auth-library";
import {JSONClient} from "google-auth-library/build/src/auth/googleauth";
import {TFile} from "obsidian";
import {FullCalendarEvent} from "./FullCalendarSync";


// If modifying these scopes, delete token.json.
const SCOPES = ["https://www.googleapis.com/auth/calendar"];

export interface GoogleCalendarEvent {
	id: string;
	date: string;
	summary: string;
	description: string;
	link: string;
}

export class GoogleCalendarSync {
	private credentialsPath: string;
	private tokenPath: string;
	public eventDb = new Array<GoogleCalendarEvent>();
	private calendar: calendar_v3.Calendar;

	constructor(private plugin: GoogleCalendarSyncPlugin) {

	}

	async setup() {
		this.credentialsPath = this.plugin.app.vault.adapter.getResourcePath(this.plugin.settings.token_file).split("/").slice(3).join("/").split("?").slice(0, -1).join("?");
		// The file token.json stores the user's access and refresh tokens, and is
		// created automatically when the authorization flow completes for the first
		// time.
		this.tokenPath = path.join(this.plugin.app.vault.adapter.getResourcePath(<string> this.plugin.manifest.dir).split("/").slice(3).join("/").split("?").slice(0, -1).join("?"), "token.json");
		// @ts-expect-error
		this.authorise().then((auth) => this.initialiseCalendarField(auth));
		this.checkFullCalendarIcsEventsForCopies();
	}

	/**
	 * From https://developers.google.com/calendar/api/quickstart/nodejs
	 */
	async loadSavedCredentialsIfExist(): Promise<JSONClient | null> {
		try {
			const content = await fs.readFile(this.tokenPath);
			const credentials = JSON.parse(content.toString());
			return google.auth.fromJSON(credentials);
		} catch (err) {
			return null;
		}
	}

	/**
	 * From https://developers.google.com/calendar/api/quickstart/nodejs
	 */
	async saveCredentials(client: OAuth2Client): Promise<void> {
		const content = await fs.readFile(this.credentialsPath);
		const keys = JSON.parse(content.toString());
		const key = keys.installed || keys.web;
		const payload = JSON.stringify({
			type: 'authorized_user',
			client_id: key.client_id,
			client_secret: key.client_secret,
			refresh_token: client.credentials.refresh_token,
		});
		await fs.writeFile(this.tokenPath, payload);
	}

	/**
	 * From https://developers.google.com/calendar/api/quickstart/nodejs
	 */
	async authorise() {
		const client = await this.loadSavedCredentialsIfExist();
		if (client) {
			return client;
		}
		const oAuthClient = await authenticate({
			scopes: SCOPES,
			keyfilePath: this.credentialsPath,
		});
		if (oAuthClient.credentials) {
			await this.saveCredentials(oAuthClient);
		}
		return client;
	}

	async initialiseCalendarField(auth: OAuth2Client) {
        this.calendar = google.calendar({version: "v3", auth: auth});
        await this.fetchGoogleCalendarEvents();
	}

	async fetchGoogleCalendarEvents() {
		console.log("listing");
		const res = await this.calendar.events.list({
			calendarId: 'primary',
			singleEvents: true,
			orderBy: 'startTime'
		});
		const events = res.data.items;
		if (!events || events.length === 0) {
			return;
		}
		for (const event of events.filter(e => e !== undefined && e !== null)) {
			const localEvent = this.plugin.full_calendar_sync.getFullCalendarEventById(<string> event["id"]);
			if (!localEvent) {
				const desc = "description" in event ? event["description"] : "";
				const matches = /^(obsidian:\/\/open\?vault=.+&file=\d{4}-\d{2}-\d{2}.*)$/gm.exec(<string> desc);
				const eventPayload = {
					"id": <string> event["id"],
					// @ts-expect-error
					"date": "date" in event["start"] ? <string> event["start"]["date"] : (<string> event["start"]["dateTime"]).split("T")[0],
					"summary": "summary" in event ? <string> event["summary"] : "Untitled",
					"description": <string> desc,
					"link": matches ? matches[1] : ""
				}
				this.eventDb.push(eventPayload);
			} else {
				let updateGoogle = false;
				if (localEvent.summary !== event["summary"]) localEvent.summary = <string> event["summary"];
				if (localEvent.description !== event["description"]) {
					localEvent.description = <string> event["description"];
					const matches = /^(obsidian:\/\/open\?vault=.+&file=\d{4}-\d{2}-\d{2}.*)$/gm.exec(<string> event["description"]);
					if (!matches) {
						localEvent.description = localEvent.link + "\n\n" + localEvent.description;
						updateGoogle = true;
					}
				}
				// @ts-expect-error
				if ("date" in event["start"] && localEvent.date !== event["start"]["date"]) {
					localEvent.date = <string> event["start"]["date"];
				// @ts-expect-error
				} else if ("dateTime" in event["start"] && localEvent.date !== event["start"]["dateTime"].split("T")[0]) {
					localEvent.date = (<string> event["start"]["dateTime"]).split("T")[0];
				}
				this.plugin.full_calendar_sync.updateFullCalendarEvent(<string> event["id"], localEvent)
				const file = await this.plugin.full_calendar_sync.getFullCalendarFileFromId(<string> event["id"]);
				console.log("updating calendar without syncing");
				if (updateGoogle) this.updateCalendarEvent(<string> event["id"], localEvent)
				else this.updateEventDb(<string> event["id"], localEvent);
				if (file) {
					await this.plugin.full_calendar_sync.updateFullCalendarEventFile(this.plugin, file, <string> event["id"], {
						summary: localEvent.summary,
						date:  localEvent.date
					}, localEvent.description)
				}
				const eventPayload = {
					"id": localEvent.id,
					"date": localEvent.date,
					"summary": "summary" in event ? <string> event["summary"] : "Untitled",
					"description": localEvent.description,
					"link": localEvent.link
				}
				this.eventDb.push(eventPayload);
			}
		}
	}

	getGoogleCalendarEventById(id: string): GoogleCalendarEvent | undefined {
		return this.eventDb.find((e) => e.id === id);
	}

	async checkAddCalendarEvent(event: FullCalendarEvent, file: TFile) {
		const storedEvent = this.eventDb.find((e) => e.date === event.date && e.summary === event.summary);
		if (storedEvent === undefined) {
			this.addCalendarEvent(event, file);
		} else {
			console.error(`GoogleCalendarSync Error Adding Event: Tried adding ${event.summary} on ${event.date} but it already exists`);
		}
	}

	addCalendarEvent(e: FullCalendarEvent, file: TFile) {
		const endDate =  new Date(e.date);
		endDate.setDate(endDate.getDate() + 1);
		const event = {
			"summary": e.summary,
			"start": {
				"date": e.date,
				"timezone": "UTC"
			},
			"end": {
				"date": e.date,
				"timezone": "UTC"
			},
			"description": e.description
		}
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const that = this;
		console.log("inserting");
		this.calendar.events.insert({
				calendarId: "primary",
				requestBody: event
			},
			async function (err: any, event: any) {
			if (err) console.error(`GoogleCalendarSync Error Adding Event: ${event.name} on ${event.date}\n${err}`);
			else {
				await that.plugin.full_calendar_sync.updateFullCalendarEventFile(that.plugin, file, event.data.id, {"google-id": event.data.id});
				e.id = event.data.id;
				that.plugin.full_calendar_sync.addFullCalendarEventToDb(e);
			}
		});
		this.checkFullCalendarIcsEventsForCopies();
	}

	updateEventDb(id: string, event: GoogleCalendarEvent) {
		this.eventDb[this.eventDb.findIndex((e) => e.id === id)] = event;
	}

	updateCalendarEvent(id: string, event: GoogleCalendarEvent) {
		const eventPayload = {
			"summary": event.summary,
			"start": {
				"date": event.date,
				"timezone": "UTC"
			},
			"end": {
				"date": event.date,
				"timezone": "UTC"
			},
			"description": event.description
		};
		console.log("updating");
		this.calendar.events.update({
			"calendarId": this.plugin.settings.calendar_id,
			"eventId": id,
			"requestBody": eventPayload
		});
		this.updateEventDb(id, event);
	}

	public syncFullCalendarEventToGoogle(id: string) {
		const event = this.plugin.full_calendar_sync.getFullCalendarEventById(id);
		if (event === undefined) return;
		console.log("syncing");
		this.updateCalendarEvent(id, event)
	}

	checkFullCalendarIcsEventsForCopies() {
		// TODO: prevent readonly ics events from appearing where there is a local markdown file
		// console.log(this.plugin.app.plugins.plugins["obsidian-full-calendar"]);
	}
}
