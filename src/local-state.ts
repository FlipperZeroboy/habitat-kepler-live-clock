import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { HabitatModule, LocalRegistration, PowerSummary } from "./habitat";

export type LocalStateStore = {
  load(): Promise<LocalRegistration | null>;
  save(registration: LocalRegistration): Promise<void>;
  delete(): Promise<void>;
};

export type JsonLocalStateStore = LocalStateStore;

function getLocalStateDirectory(cwd = process.cwd()) {
  return join(cwd, ".habitat");
}

export function getRegistrationFilePath(cwd = process.cwd()) {
  return join(getLocalStateDirectory(cwd), "registration.json");
}

export function getModulesFilePath(cwd = process.cwd()) {
  return join(getLocalStateDirectory(cwd), "habitat-modules.json");
}

async function ensureLocalStateDirectory(cwd: string) {
  await mkdir(getLocalStateDirectory(cwd), { recursive: true });
}

function cloneJson<T>(value: T): T {
  return structuredClone(value);
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

function normalizeRegistration(registration: Partial<LocalRegistration>): LocalRegistration {
  return {
    habitatUuid: registration.habitatUuid ?? "",
    habitatId: registration.habitatId ?? "",
    displayName: registration.displayName ?? "",
    registeredAt: registration.registeredAt ?? "",
    currentTick: typeof registration.currentTick === "number" ? registration.currentTick : 0,
    starterModules: Array.isArray(registration.starterModules) ? registration.starterModules : [],
    blueprints: Array.isArray(registration.blueprints) ? registration.blueprints : [],
    modules: Array.isArray(registration.modules) ? registration.modules : [],
    powerSummary: normalizePowerSummary(registration.powerSummary),
    tickHistory: Array.isArray(registration.tickHistory) ? registration.tickHistory : [],
  };
}

async function loadModules(cwd: string) {
  try {
    const contents = await readFile(getModulesFilePath(cwd), "utf8");
    const modules = JSON.parse(contents);
    return Array.isArray(modules) ? (modules as HabitatModule[]) : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function loadRegistration(cwd: string) {
  try {
    const contents = await readFile(getRegistrationFilePath(cwd), "utf8");
    return normalizeRegistration(JSON.parse(contents) as Partial<LocalRegistration>);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function saveModules(cwd: string, modules: HabitatModule[]) {
  await writeFile(getModulesFilePath(cwd), JSON.stringify(modules, null, 2) + "\n", "utf8");
}

async function saveRegistration(cwd: string, registration: LocalRegistration) {
  await writeFile(
    getRegistrationFilePath(cwd),
    JSON.stringify(registration, null, 2) + "\n",
    "utf8",
  );
}

async function deleteRegistrationFiles(cwd: string) {
  await rm(getRegistrationFilePath(cwd), { force: true });
  await rm(getModulesFilePath(cwd), { force: true });
}

function createJsonLocalStateStore(cwd: string): JsonLocalStateStore {
  return {
    async load() {
      const registration = await loadRegistration(cwd);

      if (!registration) {
        return null;
      }

      const modules = await loadModules(cwd);
      if (modules) {
        registration.modules = modules;
      }

      return registration;
    },
    async save(registration) {
      await ensureLocalStateDirectory(cwd);
      await saveRegistration(cwd, cloneJson(registration));
      await saveModules(cwd, cloneJson(registration.modules));
    },
    async delete() {
      await deleteRegistrationFiles(cwd);
    },
  };
}

export function getLocalStateStore(cwd = process.cwd()): LocalStateStore {
  return createJsonLocalStateStore(cwd);
}
