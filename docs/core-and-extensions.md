# Mcraftr Core and Extensions

Mcraftr is designed to work on its own over plain `RCON`.

That baseline product is `Quick Connect`.

From there, `Beacon` and `Relay API` integrations can enhance the experience, but they are optional layers rather than the definition of what Mcraftr is.

## Core Mcraftr

Core Mcraftr should work with no plugins or mods at all.

Core behavior includes:

- server status and health snapshots
- player basics and moderation basics
- difficulty, whitelist, operator, ban, pardon, and kick flows
- chat basics, broadcasts, and direct messages
- curated gamerule controls where plain RCON supports them
- inventory and item actions that Mcraftr can express through vanilla commands
- raw terminal command execution

This is the product baseline users should expect from `Quick Connect`.

## Beacon Enhancement

`Beacon` is Mcraftr's optional read-only data layer.

It enhances Mcraftr with filesystem-backed discovery such as:

- world discovery from disk
- plugin inventory
- structures and schematics metadata
- entity preset files
- maps and related metadata

Beacon adds visibility, metadata, and richer read-only context.

## Relay Enhancement

`Relay` is Mcraftr's optional live integration layer.

A compatible plugin or mod can implement the `Relay API` and expose a `Relay Prefix` over RCON.

Relay enhances Mcraftr with structured workflows such as:

- terminal command catalog and autocomplete
- guided command wizards
- richer WorldEdit-style actions
- advanced structured world and entity workflows

Mcraftr does not ship a default Relay implementation.

## Full Mcraftr Stack

`Full Mcraftr Stack` means:

- `RCON`
- optional `Relay`
- optional `Beacon`

In practice, Full Stack is the richer integrated experience, but Mcraftr core should still stand on its own without those optional layers.

## Product Boundary

Mcraftr should not depend on a specific private plugin or mod to define its public product shape.

- Core Mcraftr works with plain RCON
- Beacon is an optional read-only enhancement
- Relay is an optional structured integration enhancement

That separation keeps Mcraftr generic, portable, and easier to self-host.
