# Habitat Resource Scan Design

## Goal

Add a read-only `habitat scan` workflow that reports Kepler resource probabilities and quantity estimates through the existing local Habitat API boundary.

## User-facing command

The CLI command will be:

```text
habitat scan --x <integer> --y <integer> --strength <0-100> --radius <0-5> [--json]
```

The position, sensor strength, and radius are explicit options. The command never asks for or accepts a habitat ID; the local backend supplies that from saved registration state.

Human-readable output will include, for every returned tile:

- tile coordinates and distance;
- the most likely resource and its confidence;
- the estimated quantity, including exact kilograms or a minimum-to-maximum range when the estimate is probabilistic.

For a one-tile scan (`--radius 0`), human-readable output will also include every resource probability returned by Kepler. The `--json` option prints the complete Kepler response as JSON without reshaping or dropping fields.

## Architecture and data flow

```text
CLI command
  -> GET /scan on local Habitat API
    -> load saved local registration
    -> add registration.habitatId
    -> GET /world/scan on Kepler
    -> return Kepler response unchanged
```

The CLI owns argument parsing and presentation only. The local API owns request validation and transport orchestration. `src/habitat.ts` owns local registration loading, Kepler configuration, authorization, URL construction, and response parsing, following the existing Kepler request patterns.

The local API route will accept `x`, `y`, `strength`, and `radius` query parameters and map them to Kepler’s `x`, `y`, `sensorStrength`, and `radiusTiles` names. It will reject non-integer coordinates, sensor strengths outside `0–100`, and radii outside `0–5` with structured HTTP 400 errors.

## Kepler contract

The implementation follows the live OpenAPI contract for `GET /world/scan`:

- required query parameters: `habitatId`, integer `x`, integer `y`, integer `sensorStrength`, and integer `radiusTiles`;
- `sensorStrength` range: `0–100`;
- `radiusTiles` range: `0–5`;
- response shape: `{ scan: { modelVersion, origin, sensorStrength, radiusTiles, tiles } }`;
- each tile includes terrain, distance, a complete probability array, `topCandidate`, and nullable `quantityEstimate`;
- quantity estimates include resource type, kilograms, minimum, maximum, and an `exact` flag.

Kepler remains authoritative for hidden resource truth and remaining quantity. The Habitat only reports the operator position and effective sensor strength.

## Error handling

Invalid local API query values return `{ error: { message } }` with HTTP 400. Missing local registration and Kepler failures use the existing structured backend error path. The CLI uses the existing `printError` behavior and exits nonzero on failures.

## Testing strategy

Tests will be added or updated in the existing test files:

- `test/habitat.test.ts`: mocked Kepler request construction, authorization, validation, and unchanged response behavior;
- `test/server.test.ts`: `/scan` query validation, registration-backed habitat ID injection, and response passthrough;
- `test/cli.test.ts`: help discovery, human-readable tile output, one-tile probability distribution output, JSON output, and quantity presentation for exact and ranged estimates.

The required verification commands are:

```sh
bun run test
bunx tsc --noEmit
```

Live verification will additionally use the registered local Habitat service and the exact CLI command shape above, including a strength-100, radius-0 scan and a weaker or more distant scan.

## Scope boundaries

- No resource collection or mutation is added.
- No local resource truth or quantity cache is added.
- No second HTTP client design is introduced.
- No habitat ID or Kepler token is required in the CLI command.
- Existing commands and local simulation behavior remain unchanged.
