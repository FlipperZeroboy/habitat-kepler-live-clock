# Agent Instructions

## Project Overview

This is a Bun + TypeScript CLI project named `habitat`. The executable is `habitat`, implemented in `src/index.ts`, with core behavior in `src/habitat.ts`.

The CLI registers a local habitat with the Kepler Planet Server, stores local registration/module state, and simulates local power-only ticks.

## Kepler References

Agents working on Kepler integration should consult these two sources first:

- Human-facing docs: `https://planet.turingguild.com/docs`
- OpenAPI contract: `https://planet.turingguild.com/openapi.json`

Use the human docs for product overview and workflow context.

Use the OpenAPI document as the source of truth for exact request keys, endpoint shapes, authentication requirements, and response payloads.

Some Kepler docs and endpoints may require the project token:

```sh
KEPLER_PLANET_TOKEN
```

## Common Commands

Run the CLI from the repo:

```sh
bun run src/index.ts --help
```

Run tests:

```sh
bun run test
```

Typecheck:

```sh
bunx tsc --noEmit
```

Useful manual checks:

```sh
habitat status
habitat module list
habitat module status
habitat tick 60
```

## Local Configuration And State

Kepler configuration is read from `.env` using these variable names:

```sh
KEPLER_BASE_URL
KEPLER_PLANET_TOKEN
```

Do not print or commit the token. `.env` is local-only.

Local habitat state lives in `.habitat/`:

```text
.habitat/registration.json
.habitat/habitat-modules.json
```

These files are local runtime state and should not be committed.

## Implementation Notes

- Keep CLI command definitions in `src/index.ts`.
- Keep registration, persistence, module, and tick logic in `src/habitat.ts`.
- Registration hydrates starter modules from the Kepler response; do not hard-code starter modules.
- For registration and status/unregister behavior, match Kepler request and response details to the OpenAPI contract.
- Module CRUD and tick behavior are local-only after registration unless a command explicitly calls Kepler.
- `habitat tick <count>` advances local simulation by one-second ticks.
- Power draw is calculated from each module's `runtimeAttributes.status` and `runtimeAttributes.powerDrawKw`.
- Battery modules are identified by numeric `runtimeAttributes.currentEnergyKwh` and `runtimeAttributes.energyStorageKwh`.
- `habitat module set-status <module-id> <status>` only changes `runtimeAttributes.status`.
- Current local module state is saved in `.habitat/habitat-modules.json`, while registration metadata remains in `.habitat/registration.json`.
- When behavior is unclear, prefer the current project expectations already encoded in `src/` and `test/` over inventing new flows.

## Testing Expectations

When changing behavior, add or update tests in `test/habitat.test.ts` and/or `test/cli.test.ts`.

Before claiming work is complete, run:

```sh
bun run test
bunx tsc --noEmit
```

For CLI output changes, prefer tests that spawn:

```sh
bun run src/index.ts ...
```

## Git Safety

- Do not commit `.env`, `.habitat/`, `node_modules/`, or local secrets.
- Do not revert unrelated user changes.
- Do not use destructive git commands unless the user explicitly asks.
- Keep commits focused on the requested lab/task.
