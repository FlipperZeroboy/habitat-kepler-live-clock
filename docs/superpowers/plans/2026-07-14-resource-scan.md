# Habitat Resource Scan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a local-only `habitat scan` command and Kepler-backed read-only API path.

**Architecture:** `src/habitat.ts` owns the Kepler request and saved registration lookup, `src/server.ts` exposes validated `/scan`, and a new CLI command owns option parsing and presentation.

## Tasks

1. Add `WorldScanResponse` types and `scanHabitat(options)` in `src/habitat.ts`; test the saved habitat ID, query parameters, authorization, response passthrough, and bounds.
2. Add `GET /scan` in `src/server.ts`; test parameter mapping, default-independent API validation, and structured 400 errors.
3. Add `src/commands/scan.ts`, CLI parsers, and scan formatters; test default radius `0`, one-tile full probabilities including `none`, multi-tile terrain summaries, quantity ranges, JSON output, and validation messages.
4. Run `bun run test`, `bunx tsc --noEmit`, `git diff --check`, and the live scan walkthrough against the running local service.

## Constraints

- Do not require habitat ID or token in the CLI.
- Keep scan read-only and do not persist resource truth.
- Do not create or push to a new repository.
