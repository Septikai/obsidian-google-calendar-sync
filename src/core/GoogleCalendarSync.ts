import GoogleCalendarSyncPlugin from "../main";
import * as path from "path";
import {promises as fs} from "fs";
import {authenticate} from "@google-cloud/local-auth";
import {calendar_v3, google} from "googleapis"
import {OAuth2Client} from "google-auth-library";
import {JSONClient} from "google-auth-library/build/src/auth/googleauth";
import {oauth2_v2} from "googleapis";
import * as process from "process";
import {end} from "@popperjs/core";
import {TFile} from "obsidian";


// If modifying these scopes, delete token.json.
const SCOPES = ["https://www.googleapis.com/auth/calendar"];

interface GoogleCalendarEvent {
	id: string;
	date: string;
	summary: string;
	description: string;
}

export class GoogleCalendarSync {
	private credentialsPath: string;
	private tokenPath: string;
	private eventDb = new Array<GoogleCalendarEvent>();
	private calendar: calendar_v3.Calendar;

	constructor(private plugin: GoogleCalendarSyncPlugin) {

	}

	async setup() {
		this.credentialsPath = this.plugin.app.vault.adapter.getResourcePath(this.plugin.settings.token_file).split("/").slice(3).join("/").split("?").slice(0, -1).join("?");
		// The file token.json stores the user's access and refresh tokens, and is
		// created automatically when the authorization flow completes for the first
		// time.
		this.tokenPath = path.join(this.plugin.app.vault.adapter.getResourcePath(<string> this.plugin.manifest.dir).split("/").slice(3).join("/").split("?").slice(0, -1).join("?"), "token.json");
		// @ts-ignore
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
		let client = await this.loadSavedCredentialsIfExist();
		if (client) {
			return client;
		}
		let oAuthClient = await authenticate({
			scopes: SCOPES,
			keyfilePath: this.credentialsPath,
		});
		if (oAuthClient.credentials) {
			await this.saveCredentials(oAuthClient);
		}
		return client;
	}

	async initialiseCalendarField(auth: OAuth2Client) {
        this.calendar = google.calendar({version: 'v3', auth: auth});
        await this.fetchGoogleCalendarEvents();
	}

	async fetchGoogleCalendarEvents() {
		const res = await this.calendar.events.list({
			calendarId: 'primary',
			singleEvents: true,
			orderBy: 'startTime'
		});
		const events = res.data.items;
		if (!events || events.length === 0) {
			return;
		}
		function notEmpty<TValue>(value: TValue | null | undefined){
			return value !== undefined && value !== null;
		}

		events.filter(notEmpty).map((event: any) => {
			if (!(this.eventDb.find(e => e["id"] == event["id"]))) {
				this.eventDb.push({
					"id": event["id"],
					"date": "date" in event["start"] ? event["start"]["date"] : event["start"]["dateTime"].split("T")[0],
					"summary": "summary" in event ? event["summary"] : "Untitled",
					"description": "description" in event ? event["description"] : ""
				});
			}
		});
		console.log(this.eventDb);
	}

	checkAddCalendarEvent(name: string, date: string, fileLink: string, file: TFile) {
		let event = this.eventDb.find((e) => e.date === date && e.summary === name);
		if (event === undefined) {
			this.addCalendarEvent(name, date, fileLink, file);
		} else {

		}
	}

	addCalendarEvent(name: string, date: string, fileLink: string, file: TFile) {
		let endDate =  new Date(date);
		endDate.setDate(endDate.getDate() + 1);
		let event = {
			"summary": name,
			"start": {
				"date": date,
				"timezone": "UTC"
			},
			"end": {
				"date": date,
				"timezone": "UTC"
			},
			"description": fileLink
		}
		let that = this;
		this.calendar.events.insert({
			calendarId: "primary",
			requestBody: event
		}, function (err: any, event: any) {
			console.log(1)
			if (err) console.log(`GoogleCalendarSync Error Adding Event: ${name} on ${date}\n${err}`);
			else that.plugin.app.fileManager.processFrontMatter(file, (f: any) => {
				console.log(event);
				f["synced-to-google"] = true;
				f["google-id"] = event.data.id;
				return f;
			});
		});
		this.checkFullCalendarIcsEventsForCopies();
	}

	checkFullCalendarIcsEventsForCopies() {
		// @ts-ignore
		console.log(this.plugin.app.plugins.plugins["obsidian-full-calendar"]);
	}
}
