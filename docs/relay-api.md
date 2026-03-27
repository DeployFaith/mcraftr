# Relay API

This document describes the current Relay contract Mcraftr expects from a server-side integration.

For now, treat this as the Mcraftr-facing contract used by the app today, not a frozen public standard.

## What Relay Is

`Relay` is Mcraftr's live integration layer.

A server-side integration - usually a plugin or mod - implements the `Relay API` and exposes a `Relay Prefix` over RCON. Mcraftr sends structured commands to that prefix and expects structured responses back.

## Transport Model

- Mcraftr connects to the server over `RCON`
- Mcraftr prepends the configured `Relay Prefix`
- the server-side integration responds with machine-parseable output, usually JSON

Example shape:

```text
<relay-prefix> stack status
<relay-prefix> worlds list
<relay-prefix> entities list
```

## Handshake

Mcraftr currently uses `stack status` as the first compatibility check.

Expected command:

```text
<relay-prefix> stack status
```

Expected response:

- valid JSON
- should include as many of these fields as possible:
  - `providerId`
  - `providerLabel`
  - `protocolVersion`
  - `serverVersion`

This is what powers Mcraftr's saved Relay health and version reporting.

## Command Families Mcraftr Uses Today

Mcraftr currently expects Relay-backed support for command families like:

- `stack status`
- `worlds list`
- `worlds settings <world>` and related world actions
- `player locate <player>`
- `entities list`
- `entities live [world]`
- `entities remove <uuid>`
- `entities clear <world|*>`
- `entities clear radius <world> <x> <y> <z> <radius>`
- `entities spawn ...`
- `structures list [world|*>`
- `structures index status`
- `structures place ...`
- `structures remove <structureInstanceId>`
- `structures clear <world|*>`
- `structures clear radius <world> <x> <y> <z> <radius>`
- `worldedit info`
- `commands catalog`
- `commands complete64 <base64url-line>`

There are also some optional convenience paths that a Relay integration may expose, but Mcraftr should prefer plain RCON for any feature that can work cleanly without an external provider.

The exact command surface should be treated as the current app contract, not yet a finalized long-term public API.

## Terminal Catalog

`commands catalog` should return a lightweight summary list for terminal explorer, wizard discovery, and basic docs previews.

Recommended response shape:

```json
{
  "ok": true,
  "commands": [
    {
      "name": "gamerule",
      "aliases": ["gr"],
      "description": "View or update gamerules",
      "permission": "minecraft.command.gamerule",
      "source": "minecraft"
    }
  ]
}
```

Recommended fields:

- `name`
- `aliases`
- `description`
- `permission`
- `source`

Optional fields:

- `wizardId`
- `riskLevel`

Implementation guidance:

- keep `commands catalog` intentionally small
- avoid long docs prose and large examples arrays
- avoid nested metadata that is only needed when a single command is selected
- avoid repeated provider metadata on every command row

Reason:

- Mcraftr loads this list for terminal explorer and command discovery
- oversized Relay catalog payloads become fragile over the current transport and can force Mcraftr to fall back to local/manual terminal mode

## Future Command Detail Direction

For richer terminal docs, a Relay integration may later support:

```text
<relay-prefix> commands describe <command>
```

Suggested response shape:

```json
{
  "ok": true,
  "command": {
    "name": "gamerule",
    "aliases": ["gr"],
    "description": "View or update gamerules",
    "usage": "/gamerule <rule> [value]",
    "permission": "minecraft.command.gamerule",
    "source": "minecraft",
    "examples": [
      "/gamerule keepInventory true",
      "/gamerule doDaylightCycle false"
    ],
    "notes": [
      "Boolean and numeric values depend on the selected rule"
    ]
  }
}
```

Suggested detail fields:

- `name`
- `aliases`
- `description`
- `usage`
- `permission`
- `source`
- `examples`
- `notes`
- optional `wizardId`

Guidance:

- keep `commands catalog` lightweight
- load richer command detail on demand
- let Mcraftr infer wizard support from names and aliases unless a stable provider-side `wizardId` is cheap to maintain

## Entity Contract

`entities live` is for the live entity viewer, targeted deletes, and safe listed-only cleanup.

Recommended response shape:

```json
{
  "ok": true,
  "entities": [
    {
      "uuid": "00000000-0000-0000-0000-000000000000",
      "id": "zombie",
      "label": "Zombie",
      "category": "hostile",
      "world": "world",
      "location": { "x": 12, "y": 64, "z": -4 }
    }
  ],
  "limit": 200,
  "totalEntities": 431,
  "truncated": true
}
```

Guidance:

- cap large live payloads on the Relay side before serialization
- always return `totalEntities`
- set `truncated: true` when the viewer is only seeing a safe subset
- avoid failing the whole command when the world is simply busy or crowded

`entities clear <world|*>` is the dangerous scope-wide clear.

`entities clear radius <world> <x> <y> <z> <radius>` is the dangerous radius clear centered on the active player's live location at click time.

Recommended destructive response fields:

- `matchedCount`
- `removedCount`
- `failedCount`
- optional `warning`

## Structure Contract

Mcraftr treats structures in the viewer as a provider-backed index of discoverable structure instances.

In v1, that means:

- native or generated structure instances
- provider-tracked placed structures

It does not mean arbitrary player-built assemblies.

Recommended `structures list` response shape:

```json
{
  "ok": true,
  "items": [
    {
      "id": "worldgen:world:village:10:60:10:20:70:20",
      "kind": "worldgen",
      "world": "world",
      "structureId": "minecraft:village",
      "structureLabel": "Village",
      "sourceKind": "native-worldgen",
      "originX": 10,
      "originY": 60,
      "originZ": 10,
      "minX": 10,
      "minY": 60,
      "minZ": 10,
      "maxX": 20,
      "maxY": 70,
      "maxZ": 20
    }
  ],
  "total": 1,
  "indexing": {
    "worlds": [
      { "world": "world", "phase": "ready", "processed": 0, "total": 0 }
    ]
  }
}
```

Guidance:

- structure ids must be stable enough to support individual delete actions
- bounds should be complete enough for exact-point matching and radius intersection checks
- radius clears should remove any structure whose indexed footprint intersects the radius, not just structures whose origin happens to be nearby
- when indexing is still warming up, report that through `structures index status` and the `indexing` payload instead of silently pretending the world is complete

`structures remove <structureInstanceId>` removes one indexed structure instance.

`structures clear <world|*>` is the dangerous scope-wide clear.

`structures clear radius <world> <x> <y> <z> <radius>` is the dangerous radius clear around the active player.

## Capabilities

Relay integrations should advertise supported capability flags in `stack status`.

Current capability flags used by Mcraftr:

- `entity_delete`
- `entity_clear_scope`
- `entity_clear_radius`
- `structure_index`
- `structure_delete`
- `structure_clear_scope`
- `structure_clear_radius`

These flags let Mcraftr hide destructive controls when the provider has not implemented the matching command family.

## Response Expectations

Mcraftr expects Relay responses to be machine-readable.

Best practice:

- return JSON for structured commands
- keep stdout free of unrelated formatting when possible
- return clear `ok` and `error` fields where relevant

Mcraftr currently detects failures such as:

- unknown prefix / invalid Relay Prefix
- command rejection by the server
- non-JSON responses where JSON is expected
- JSON parse failures

## Prefix Rules

The `Relay Prefix` should:

- be callable over RCON
- map to the server-side integration's command namespace
- remain stable per saved server in Mcraftr

Mcraftr stores the Relay Prefix per server and uses it for future requests.

## Version and Capability Reporting

Where possible, a Relay integration should report:

- `providerId`
- `providerLabel`
- `protocolVersion`
- `serverVersion`

Mcraftr uses that data for status, compatibility hints, and display.

## Beacon Is Separate

Relay is for live structured operations.

`Beacon` is separate and handles read-only filesystem-backed discovery and metadata. A complete Full Mcraftr Stack typically uses both.

See `docs/beacon.md`.

## Future Direction

Future work may split this into:

- a tighter minimum required Relay contract
- optional capability groups
- supported/community integration guidance

For now, this doc exists to make Mcraftr-compatible integrations easier to understand and build.
