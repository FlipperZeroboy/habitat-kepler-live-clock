# Habitat Resource Scan Design

## Goal

Add a read-only `habitat scan` workflow that sends the local Habitat position and sensor strength through the local Habitat API to Kepler, then displays resource probabilities and quantity estimates.

## Command

```text
habitat scan --x <integer> --y <integer> --strength <0-100> [--radius <0-5>] [--json]
```

`--radius` defaults to `0`. The command never accepts a habitat ID or Kepler token.

For one tile, human output includes position, sensor strength, terrain, every official material plus `none`, probabilities, the top candidate, confidence, and quantity estimate. For a larger radius, it summarizes each returned tile with coordinates, distance, terrain, top candidate, confidence, and quantity estimate. JSON output preserves the complete Kepler response.

## Data flow

```text
CLI -> GET /scan on local Habitat API -> GET /world/scan on Kepler
```

The local API loads the saved registration and supplies `habitatId`. Kepler remains authoritative for hidden resource truth and remaining quantity; no scan truth is stored locally.

## Validation and testing

The local API validates integer `x` and `y`, sensor strength `0–100`, and radius `0–5`. Tests cover request construction, habitat ID injection, response passthrough, CLI formatting, exact strength-100 distance-0 results, probabilistic ranges, JSON output, and invalid inputs.

Required checks:

```sh
bun run test
bunx tsc --noEmit
```

Live checks use the running registered Habitat service and do not publish changes.
