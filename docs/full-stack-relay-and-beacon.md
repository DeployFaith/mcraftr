# Full Stack: Relay and Beacon

This guide explains the three layers Mcraftr can use to talk to your Minecraft server.

## Stack Modes

- `Quick Connect` uses `RCON` only.
- `Full Mcraftr Stack` uses `RCON + Relay + Beacon`.

`Quick Connect` is the real baseline Mcraftr product. `Full Mcraftr Stack` is the richer, world-aware setup built on optional Relay and Beacon enhancements.

## RCON

`RCON` is the raw command transport.

Mcraftr uses it for:

- standard command execution
- basic admin actions
- chat and moderation flows
- connectivity to both Quick Connect and Full Stack servers

Quick Connect stops here, and it should still feel like a complete baseline experience.

## Relay

`Relay` is Mcraftr's live integration layer.

Relay powers optional structured live operations that plain RCON cannot model cleanly, including:

- world-aware actions and settings
- structured entity and structure workflows
- terminal catalog, autocomplete, and guided command flows
- richer plugin stack and server capability reporting

Mcraftr does not ship the server-side Relay implementation by itself.

Instead, your Minecraft server needs a compatible `Relay API` integration - usually a plugin or mod - that:

- exposes a `Relay Prefix` over RCON
- responds to Mcraftr's structured Relay commands
- returns the data Mcraftr expects for advanced workflows

For the current Mcraftr-facing contract, see `docs/relay-api.md`.

## Beacon

`Beacon` is Mcraftr's read-only data layer.

Beacon runs as a separate service and mounts your Minecraft data directory read-only. Mcraftr uses it for optional file-backed discovery and metadata such as:

- world discovery from disk
- plugin inventory
- structures and schematics
- entity preset files
- map links and map-aware metadata

Beacon does not replace Relay. Beacon reads data; Relay handles live structured operations.

For the current Mcraftr-facing Beacon behavior, see `docs/beacon.md`.

## How They Work Together

- `RCON` executes raw commands.
- `Relay` unlocks Mcraftr's live structured workflows.
- `Beacon` unlocks Mcraftr's read-only world and filesystem context.

That means:

- `Quick Connect` is ideal when you want the core Mcraftr product over plain RCON.
- `Full Mcraftr Stack` is ideal when you want worlds, structures, entities, maps, richer terminal help, and the integrated experience built on optional Relay and Beacon layers.

## What Happens Without Relay or Beacon

Mcraftr can still run without them.

- without `Relay`, Mcraftr still works in core RCON mode and loses only structured live enhancements
- without `Beacon`, Mcraftr still works and loses only file-backed world, structure, plugin, and metadata enhancements
- without both, Mcraftr stays in `Quick Connect`, which remains the intended baseline mode

The app should guide users toward the full-stack setup when they open a feature that depends on Relay, Beacon, or both.

## Future Direction

For now, these docs describe how Relay and Beacon work for Mcraftr itself.

Future work may add:

- easier support for popular community Relay integrations
- broader compatibility guidance for plugin and mod authors
- more formal external pathways around Beacon
