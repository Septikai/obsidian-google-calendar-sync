# Obsidian Google Calendar Sync

This is a plugin to sync events from [Full Calendar](https://github.com/davish/obsidian-full-calendar) to Google Calendar.

I installed the Full Calendar plugin, but was quickly annoyed by the fact that events from Google calendar are read only due to how ICS links work, and that any events I added would not show up on Google calendar. So with my very limited knowledge of Obsidian API and my nonexistent skills in TypeScript, I decided to try and fix this.

## The Goal

This plugin, when complete, should be able to:
- add events created in obsidian to google calendar
- modify those events when they are updated in obsidian
- remove events create in obsidian from Google calendar when they are deleted (I do not currently intend to try and make events created in google calendar writeable, but maybe in the future)
- only display each event once despite having a local copy in obsidian and a copy in Google calendar

This is intended to be used at the same time as an ICS link in Full Calendar.

## Current State

This is very early in development currently, and at the time of writing is only capable of adding events created in obsidian to Google calendar. Which then leads to them showing up twice as they are both in obsidian and in Google Calendar, which is read by Full Calendar using the ICS link.

## Installation

In its current state, this is not intended for installation. If you decide to install it anyway, good luck. I'll write installation instructions when this is in a usable state. I can direct you to [this](https://developers.google.com/calendar/api/quickstart/nodejs) quickstart guide by Google though, as you will need to follow all steps there up until you have a `credentials.json` file in order to use this plugin.

## Disclaimer

As I stated multiple times above, this is very early in development and is not intended to be installed by anyone other than me. As such, I take no responsibility for any bugs you find and mess up your calendar with, as this is not even close to finished currently.
