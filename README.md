# Obsidian Google Calendar Sync

This is a plugin to sync events from [Full Calendar](https://github.com/davish/obsidian-full-calendar) to Google Calendar.

I installed the Full Calendar plugin, but was quickly annoyed by the fact that events from Google calendar are read only due to how ICS links work, and that any events I added would not show up on Google calendar. So with my very limited knowledge of Obsidian API and my nonexistent skills in TypeScript, I decided to try and fix this.

## The Goal

This plugin, when complete, should be able to:
- [x] add events created in obsidian to google
- [x] modify those events when they are updated in obsidian or google
- [ ] remove events created in obsidian from Google calendar when they are deleted
- [ ] support events that are not all day (but not events starting and ending in different days, because Full Calendar does not support those)
- [ ] not display events from an ICS link if there is a note in obsidian representing that event (to prevent duplicate events, where one is from the notes and one is from the ICS link)
- [ ] optionally create local copies of events already on or created on google calendar (as seen via the ICS link) to allow them to be edited through obsidian

This is intended to be used at the same time as an ICS link in Full Calendar.

## Current State

This is very early in development currently, and at the time of writing is only capable of adding, modifying and renaming full-day events created in obsidian. Which then leads to them showing up twice as they are both in obsidian and in Google Calendar, which is read by Full Calendar using the ICS link.

## Installation

In its current state, this is not intended for installation. If you decide to install it anyway, go ahead, and good luck. I'll write installation instructions when this reaches a more complete state. I can direct you to [this](https://developers.google.com/calendar/api/quickstart/nodejs) quickstart guide by Google though for if you do decide to install it, as you will need to follow all steps there up until you have a `credentials.json` file in order to use this plugin thanks to how Google Calendar's API works. I will see if there is a more convenient way to do that once the plugin is mostly complete.

## Disclaimer

As I stated multiple times above, this is very early in development and is not intended to be installed by anyone other than me. As such, I take no responsibility for any bugs you find and mess up your calendar with, as this is not even close to finished currently. But if you do find any bugs, please let me know so I can fix them.
