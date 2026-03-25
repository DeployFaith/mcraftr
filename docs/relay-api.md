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
- `entities live`
- `entities spawn ...`
- `structures place ...`
- `worldedit info`
- `commands catalog`
- `commands complete64 <base64url-line>`

There are also convenience paths routed through Relay, including things like:

- `broadcast ...`
- `msg ...`
- `kit ...`
- curated gamerule reads and writes

The exact command surface should be treated as the current app contract, not yet a finalized long-term public API.

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
