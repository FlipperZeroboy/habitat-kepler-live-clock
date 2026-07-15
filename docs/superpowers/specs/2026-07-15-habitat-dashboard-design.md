# Habitat Operations Dashboard Design

## Goal

Add a small React and TypeScript operations dashboard to the existing `habitat-cli` project. The dashboard uses the existing Hono REST backend as its only source of Habitat state, while keeping the CLI and website on the same server-owned state.

## Reference and visual direction

The supplied Swiss Gaming dashboard screenshot is used only as layout inspiration: a left navigation rail, dark glass-like panels, a prominent top summary, compact metric cards, and a dense data table. Habitat-specific labels, values, controls, and artwork will be used instead of the reference's branding, copy, or imagery.

The initial experience is one responsive operational screen. The sidebar is a visual navigation rail with the dashboard as the active destination; separate pages are out of scope for this version.

## Architecture and data flow

The browser talks to the Hono API through same-origin `/api/*` paths in development and production. Vite proxies `/api` to the backend during development. The production Hono server serves the built React files and keeps the REST routes on the same port.

The React app has one typed API client and one dashboard state coordinator. It loads registration, status, modules, power overview, and solar irradiance through REST. Mutations use `POST /api/registration`, `DELETE /api/registration`, `PUT /api/modules/:id`, and `POST /api/ticks`, followed by a fresh dashboard reload. The browser never reads SQLite, loads `.env`, calls Kepler, or calculates simulation state.

The existing `GET /power/overview` route will return a backend-owned view containing the current modules, power generation, consumption, net power, battery state, and solar condition. This keeps power semantics in the backend and avoids duplicating Habitat business rules in React.

## Dashboard content

- Registration card: registered/unregistered state, Habitat name and ID when present, register form when absent, and a separated unregister action that requires confirmation.
- Power cards: generation, consumption, net balance, and battery energy/capacity.
- Solar and simulation panel: current irradiance/condition, current tick, latest tick result, preset buttons for 1, 60, 600, and 3,600 ticks, and a custom positive whole-number input.
- Module table: module name/type, effective status, power usage, generation where available, battery state where available, and an offline/online control.
- Feedback states: initial loading, empty unregistered state, disabled controls during mutations, and readable API errors with retry/refresh actions.

## Theme and accessibility

Light and dark modes use CSS custom properties rather than hard-coded one-off colors. Text, borders, focus rings, status pills, buttons, tables, and danger actions will remain readable in both themes. The layout will remain usable at narrow widths by stacking metric cards and allowing the module table to scroll horizontally.

## Verification

Automated verification will cover API request/response handling, route payload changes, and React behavior for registration, module status, tick presets/custom values, and error/loading states where the project test setup supports it. The final checks are `bun run test` and `bunx tsc --noEmit`.

Live verification will run the backend and Vite dev server, then exercise registration, module offline/online, multiple tick presets, a custom tick value, unregister/re-register, and cross-check website state against `habitat module status` and `habitat power status`. The built mode will be checked with `bun run build:web` and Hono serving the dashboard from port 8787.

## Explicit non-goals

No blueprint construction, inventory management, crew controls, EVA controls, browser-only API routes, direct Kepler calls, database access from the browser, fake Habitat values, repository creation, commit, push, or pull request are part of this task.
