# Beacon

This document explains how Mcraftr uses Beacon today.

For now, Beacon is documented as part of Mcraftr's advanced self-host flow, not as a broad external platform API.

## What Beacon Is

`Beacon` is Mcraftr's read-only data layer.

Beacon runs as a separate service and scans your Minecraft server data directory so Mcraftr can work with filesystem-backed information that plain RCON cannot provide reliably.

## What Beacon Powers In Mcraftr

Beacon is used for read-only discovery and metadata such as:

- plugin inventory
- world discovery from disk
- structures and schematics catalog data
- entity preset files
- map metadata and linked map surfaces
- capability and mount diagnostics

Beacon is especially important for the richer world-aware parts of `Full Mcraftr Stack`.

## What Beacon Does Not Do

Beacon does not replace `Relay`.

- Beacon reads files and metadata
- Relay powers live structured operations

If you want the full designed Mcraftr experience, you usually need both.

## Runtime Shape

Beacon is an HTTP service.

Mcraftr currently uses endpoints such as:

- `/health`
- `/plugin-stack`
- `/worlds`
- `/maps`
- `/schematics`
- `/structures`
- `/structures/metadata`
- `/entities`

Beacon can optionally require a bearer token.

## Mounting Requirements

Beacon should mount your Minecraft data directory read-only.

Mcraftr expects Beacon to be able to read things like:

- world folders
- plugin directories and jars
- structure and schematic roots
- entity preset roots

Typical examples in Mcraftr configs include:

- `/data/plugins`
- `/data/world`
- `/data/world_nether`
- `/data/world_the_end`
- `plugins/WorldEdit/schematics`
- `mcraftr/entity-presets`

## Health and Capabilities

Beacon exposes a health endpoint that returns:

- `ok`
- supported capabilities

Mcraftr uses that to validate Beacon during server setup and to display stack health inside the app.

## When Beacon Helps Without Relay

Even without Relay, Beacon can still make Mcraftr more useful by powering read-only discovery and metadata surfaces.

That is important for the future product direction, even though Mcraftr still treats `Full Mcraftr Stack` as the complete recommended setup.

## Future Direction

Future work may make Beacon more broadly consumable outside Mcraftr.

For now, the priority is:

- documenting Beacon clearly for Mcraftr users
- stabilizing how Mcraftr uses Beacon
- improving Mcraftr's Beacon-backed features and locked-state guidance
