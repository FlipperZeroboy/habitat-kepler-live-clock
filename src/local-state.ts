import { access, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import type { HabitatModule, LocalRegistration, PowerSummary } from "./habitat";

export type LocalStateStore = {
  load(): Promise<LocalRegistration | null>;
  save(registration: LocalRegistration): Promise<void>;
  delete(): Promise<void>;
};

export function getDatabaseFilePath(cwd = process.cwd()) {
  return join(cwd, ".habitat", "habitat.sqlite");
}

function normalizePowerSummary(summary?: Partial<PowerSummary>): PowerSummary {
  return {
    totalPowerDrawKw: typeof summary?.totalPowerDrawKw === "number" ? summary.totalPowerDrawKw : 0,
    energyUsedKwh: typeof summary?.energyUsedKwh === "number" ? summary.energyUsedKwh : 0,
    batteryEnergyKwh: typeof summary?.batteryEnergyKwh === "number" ? summary.batteryEnergyKwh : 0,
    batteryCapacityKwh: typeof summary?.batteryCapacityKwh === "number" ? summary.batteryCapacityKwh : 0,
    powerShortageKwh: typeof summary?.powerShortageKwh === "number" ? summary.powerShortageKwh : 0,
  };
}

function normalizeRegistration(registration: Partial<LocalRegistration>, modules: HabitatModule[]): LocalRegistration {
  return {
    habitatUuid: registration.habitatUuid ?? "",
    habitatId: registration.habitatId ?? "",
    displayName: registration.displayName ?? "",
    registeredAt: registration.registeredAt ?? "",
    currentTick: typeof registration.currentTick === "number" ? registration.currentTick : 0,
    starterModules: [],
    blueprints: [],
    modules,
    powerSummary: normalizePowerSummary(registration.powerSummary),
    tickHistory: Array.isArray(registration.tickHistory) ? registration.tickHistory : [],
  };
}

function initializeDatabase(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS habitat_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      habitat_uuid TEXT NOT NULL,
      habitat_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      registered_at TEXT NOT NULL,
      current_tick INTEGER NOT NULL,
      power_summary_json TEXT NOT NULL,
      tick_history_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS modules (
      id TEXT PRIMARY KEY,
      habitat_id TEXT NOT NULL,
      blueprint_id TEXT NOT NULL,
      module_type TEXT NOT NULL,
      display_name TEXT NOT NULL,
      connected_to_json TEXT NOT NULL,
      runtime_attributes_json TEXT NOT NULL,
      capabilities_json TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

function openDatabase(path: string) {
  const db = new Database(path);
  initializeDatabase(db);
  return db;
}

async function databaseExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function createSqliteLocalStateStore(cwd: string): LocalStateStore {
  const databaseFile = getDatabaseFilePath(cwd);

  return {
    async load() {
      if (!(await databaseExists(databaseFile))) {
        return null;
      }

      const db = openDatabase(databaseFile);
      try {
        const state = db.query("SELECT * FROM habitat_state WHERE id = 1").get<Record<string, unknown>>();
        if (!state) {
          return null;
        }

        const modules = db.query("SELECT * FROM modules ORDER BY rowid").all<Record<string, string>>();
        return normalizeRegistration(
          {
            habitatUuid: String(state.habitat_uuid),
            habitatId: String(state.habitat_id),
            displayName: String(state.display_name),
            registeredAt: String(state.registered_at),
            currentTick: Number(state.current_tick),
            powerSummary: JSON.parse(String(state.power_summary_json)),
            tickHistory: JSON.parse(String(state.tick_history_json)),
          },
          modules.map((module) => ({
            id: module.id,
            habitatId: module.habitat_id,
            blueprintId: module.blueprint_id,
            moduleType: module.module_type,
            displayName: module.display_name,
            connectedTo: JSON.parse(module.connected_to_json),
            runtimeAttributes: JSON.parse(module.runtime_attributes_json),
            capabilities: JSON.parse(module.capabilities_json),
            source: module.source as HabitatModule["source"],
            createdAt: module.created_at,
            updatedAt: module.updated_at,
          })),
        );
      } finally {
        db.close();
      }
    },
    async save(registration) {
      await mkdir(join(cwd, ".habitat"), { recursive: true });
      const db = openDatabase(databaseFile);
      try {
        const localRegistration = normalizeRegistration(registration, registration.modules);
        const save = db.transaction(() => {
          db.query("DELETE FROM habitat_state").run();
          db.query("DELETE FROM modules").run();
          db.query(`
            INSERT INTO habitat_state
              (id, habitat_uuid, habitat_id, display_name, registered_at, current_tick, power_summary_json, tick_history_json)
            VALUES (1, $habitatUuid, $habitatId, $displayName, $registeredAt, $currentTick, $powerSummary, $tickHistory)
          `).run({
            $habitatUuid: localRegistration.habitatUuid,
            $habitatId: localRegistration.habitatId,
            $displayName: localRegistration.displayName,
            $registeredAt: localRegistration.registeredAt,
            $currentTick: localRegistration.currentTick,
            $powerSummary: JSON.stringify(localRegistration.powerSummary),
            $tickHistory: JSON.stringify(localRegistration.tickHistory),
          });

          const insertModule = db.query(`
            INSERT INTO modules
              (id, habitat_id, blueprint_id, module_type, display_name, connected_to_json, runtime_attributes_json, capabilities_json, source, created_at, updated_at)
            VALUES ($id, $habitatId, $blueprintId, $moduleType, $displayName, $connectedTo, $runtimeAttributes, $capabilities, $source, $createdAt, $updatedAt)
          `);

          for (const module of localRegistration.modules) {
            insertModule.run({
              $id: module.id,
              $habitatId: module.habitatId,
              $blueprintId: module.blueprintId,
              $moduleType: module.moduleType,
              $displayName: module.displayName,
              $connectedTo: JSON.stringify(module.connectedTo),
              $runtimeAttributes: JSON.stringify(module.runtimeAttributes),
              $capabilities: JSON.stringify(module.capabilities),
              $source: module.source,
              $createdAt: module.createdAt,
              $updatedAt: module.updatedAt,
            });
          }
        });
        save();
      } finally {
        db.close();
      }
    },
    async delete() {
      await rm(databaseFile, { force: true });
    },
  };
}

export function getLocalStateStore(cwd = process.cwd()): LocalStateStore {
  return createSqliteLocalStateStore(cwd);
}
