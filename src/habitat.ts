import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type FetchLike = typeof fetch;

type JsonObject = Record<string, unknown>;

const runtimeStatuses = ["offline", "idle", "online", "active", "damaged"] as const;

export type RuntimeStatus = (typeof runtimeStatuses)[number];

export type StarterModule = {
  id: string;
  blueprintId: string;
  displayName: string;
  connectedTo: string[];
  runtimeAttributes: JsonObject;
  capabilities: string[];
};

export type ProductionBlueprint = {
  id?: string;
  blueprintId: string;
  displayName: string;
  description?: string;
  status?: "draft" | "published" | string;
  output?: JsonObject;
  inputs?: JsonObject;
  productionCost?: JsonObject;
  requiredFacility?: JsonObject;
  buildTicks?: number;
  prerequisites?: string[];
  unlocks?: string[];
  repeatable?: boolean;
  level?: number | null;
  target?: JsonObject;
  facilityLevel?: JsonObject;
  attachmentPoints?: JsonObject;
  attachmentRequirements?: JsonObject[];
  runtimeAttributes?: JsonObject;
  capabilities?: string[];
};

export type BlueprintCatalogResponse = {
  catalogVersion: string;
  blueprints: ProductionBlueprint[];
};

export type IndustryResource = {
  id?: string;
  resourceType: string;
  displayName: string;
  kind: string;
  rarity: string;
  description?: string;
  unit?: string;
};

export type ResourceCatalogResponse = {
  catalogVersion: string;
  resources: IndustryResource[];
};

export type HabitatModule = {
  id: string;
  habitatId: string;
  blueprintId: string;
  moduleType: string;
  displayName: string;
  connectedTo: string[];
  runtimeAttributes: JsonObject;
  capabilities: string[];
  source: "kepler-registration" | "local-blueprint";
  createdAt: string;
  updatedAt: string;
};

export type PowerSummary = {
  totalPowerDrawKw: number;
  energyUsedKwh: number;
  batteryEnergyKwh: number;
  batteryCapacityKwh: number;
  powerShortageKwh: number;
};

export type TickSummary = PowerSummary & {
  startTick: number;
  currentTick: number;
  ticksAdvanced: number;
};

export type LocalRegistration = {
  habitatUuid: string;
  habitatId: string;
  displayName: string;
  registeredAt: string;
  currentTick: number;
  starterModules: StarterModule[];
  blueprints: ProductionBlueprint[];
  modules: HabitatModule[];
  powerSummary: PowerSummary;
  tickHistory: TickSummary[];
};

export type HabitatStatus = {
  habitat: {
    id: string;
    habitatSlug: string;
    displayName: string;
    catalogVersion: string;
    status: string;
    lastSeenAt?: string | null;
  };
};

export type ConfigCheck = {
  baseUrl: string;
  tokenLoaded: boolean;
  registrationFile: string;
};

type RuntimeOptions = {
  cwd?: string;
  fetchImpl?: FetchLike;
  projectRoot?: string;
};

type RegisterOptions = RuntimeOptions & {
  randomUuid?: () => string;
  now?: () => Date;
};

type ModuleCreateOptions = RuntimeOptions & {
  randomUuid?: () => string;
  now?: () => Date;
};

type ModuleUpdateOptions = RuntimeOptions & {
  now?: () => Date;
};

type CreateModuleInput = {
  blueprintId: string;
  name?: string;
};

type UpdateModuleInput = {
  name?: string;
  status?: string;
  health?: number;
};

type KeplerConfig = {
  baseUrl: string;
  token: string;
};

const defaultProjectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

export function getHabitatDirectory(cwd = process.cwd()) {
  return join(cwd, ".habitat");
}

export function getRegistrationFilePath(cwd = process.cwd()) {
  return join(getHabitatDirectory(cwd), "registration.json");
}

export function getModulesFilePath(cwd = process.cwd()) {
  return join(getHabitatDirectory(cwd), "habitat-modules.json");
}

async function ensureHabitatDirectory(cwd: string) {
  await mkdir(getHabitatDirectory(cwd), { recursive: true });
}

async function readEnvFile(path: string) {
  try {
    return parseEnv(await readFile(path, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function resolveProjectRoot(
  cwd: string,
  projectRoot = process.env.HABITAT_PROJECT_ROOT ?? defaultProjectRoot,
) {
  const candidates = [
    process.env.HABITAT_PROJECT_ROOT,
    cwd,
    projectRoot,
    defaultProjectRoot,
  ].filter((candidate): candidate is string => Boolean(candidate));
  const uniqueCandidates = [...new Set(candidates)];

  for (const candidate of uniqueCandidates) {
    const envValues = await readEnvFile(join(candidate, ".env"));

    if (
      envValues?.has("KEPLER_BASE_URL") &&
      envValues.has("KEPLER_PLANET_TOKEN")
    ) {
      return candidate;
    }
  }

  return projectRoot;
}

function parseEnv(contents: string) {
  const values = new Map<string, string>();

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    values.set(key, value.replace(/^["']|["']$/g, ""));
  }

  return values;
}

async function loadConfig(cwd: string): Promise<KeplerConfig> {
  const envPath = join(cwd, ".env");
  const fileValues = (await readEnvFile(envPath)) ?? new Map<string, string>();

  const baseUrl = fileValues.get("KEPLER_BASE_URL") ?? process.env.KEPLER_BASE_URL;
  const token = fileValues.get("KEPLER_PLANET_TOKEN") ?? process.env.KEPLER_PLANET_TOKEN;

  if (!baseUrl) {
    throw new Error("Missing KEPLER_BASE_URL in .env.");
  }

  if (!token) {
    throw new Error("Missing KEPLER_PLANET_TOKEN in .env.");
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    token,
  };
}

export async function checkLocalConfig(options: RuntimeOptions = {}): Promise<ConfigCheck> {
  const cwd = await resolveProjectRoot(
    options.cwd ?? process.cwd(),
    options.projectRoot,
  );
  const config = await loadConfig(cwd);

  return {
    baseUrl: config.baseUrl,
    tokenLoaded: config.token.length > 0,
    registrationFile: getRegistrationFilePath(cwd),
  };
}

export async function loadLocalRegistration(cwd = process.cwd()) {
  try {
    const contents = await readFile(getRegistrationFilePath(cwd), "utf8");
    const registration = normalizeRegistration(JSON.parse(contents) as Partial<LocalRegistration>);
    const modules = await loadHabitatModules(cwd);

    if (modules) {
      registration.modules = modules;
    }

    return registration;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function cloneJson<T>(value: T): T {
  return structuredClone(value);
}

async function loadHabitatModules(cwd: string) {
  try {
    const contents = await readFile(getModulesFilePath(cwd), "utf8");
    const modules = JSON.parse(contents);
    return Array.isArray(modules) ? modules as HabitatModule[] : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
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

function normalizePowerSummary(summary?: Partial<PowerSummary>): PowerSummary {
  return {
    totalPowerDrawKw: typeof summary?.totalPowerDrawKw === "number" ? summary.totalPowerDrawKw : 0,
    energyUsedKwh: typeof summary?.energyUsedKwh === "number" ? summary.energyUsedKwh : 0,
    batteryEnergyKwh: typeof summary?.batteryEnergyKwh === "number" ? summary.batteryEnergyKwh : 0,
    batteryCapacityKwh: typeof summary?.batteryCapacityKwh === "number" ? summary.batteryCapacityKwh : 0,
    powerShortageKwh: typeof summary?.powerShortageKwh === "number" ? summary.powerShortageKwh : 0,
  };
}

function hydrateStarterModules(
  habitatId: string,
  starterModules: StarterModule[],
  timestamp: string,
): HabitatModule[] {
  return starterModules.map((starterModule) => ({
    id: starterModule.id,
    habitatId,
    blueprintId: starterModule.blueprintId,
    moduleType: starterModule.blueprintId,
    displayName: starterModule.displayName,
    connectedTo: Array.isArray(starterModule.connectedTo)
      ? [...starterModule.connectedTo]
      : [],
    runtimeAttributes: cloneJson(starterModule.runtimeAttributes ?? {}),
    capabilities: Array.isArray(starterModule.capabilities)
      ? [...starterModule.capabilities]
      : [],
    source: "kepler-registration",
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
}

async function saveLocalRegistration(cwd: string, registration: LocalRegistration) {
  await ensureHabitatDirectory(cwd);
  await writeFile(
    getRegistrationFilePath(cwd),
    JSON.stringify(registration, null, 2) + "\n",
    "utf8",
  );
  await saveHabitatModules(cwd, registration.modules);
}

async function saveHabitatModules(cwd: string, modules: HabitatModule[]) {
  await ensureHabitatDirectory(cwd);
  await writeFile(
    getModulesFilePath(cwd),
    JSON.stringify(modules, null, 2) + "\n",
    "utf8",
  );
}

async function deleteLocalRegistration(cwd: string) {
  await rm(getRegistrationFilePath(cwd), { force: true });
  await rm(getModulesFilePath(cwd), { force: true });
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function assertOk(response: Response, action: string) {
  if (response.ok) {
    return;
  }

  let message = `${action} failed with HTTP ${response.status}.`;

  try {
    const body = await parseJsonResponse(response);
    if (body?.error?.message) {
      message = body.error.message;
    }
  } catch {
    // Keep the status-based message when the error body is not JSON.
  }

  throw new Error(message);
}

export async function registerHabitat(name: string, options: RegisterOptions = {}) {
  const cwd = await resolveProjectRoot(
    options.cwd ?? process.cwd(),
    options.projectRoot,
  );
  const existingRegistration = await loadLocalRegistration(cwd);

  if (existingRegistration) {
    throw new Error(`Habitat is already registered: ${existingRegistration.habitatId}`);
  }

  const config = await loadConfig(cwd);
  const habitatUuid = (options.randomUuid ?? randomUUID)();
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`${config.baseUrl}/habitats/register`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      displayName: name,
      habitatUuid,
    }),
  });

  await assertOk(response, "Registration");
  const body = await parseJsonResponse(response);
  const registeredAt = (options.now ?? (() => new Date()))().toISOString();
  const starterModules = Array.isArray(body.starterModules) ? body.starterModules : [];

  const registration: LocalRegistration = {
    habitatUuid,
    habitatId: body.habitatId,
    displayName: name,
    registeredAt,
    currentTick: 0,
    starterModules,
    blueprints: Array.isArray(body.blueprints) ? body.blueprints : [],
    modules: hydrateStarterModules(body.habitatId, starterModules, registeredAt),
    powerSummary: normalizePowerSummary(),
    tickHistory: [],
  };

  await saveLocalRegistration(cwd, registration);
  return registration;
}

async function loadRequiredRegistration(options: RuntimeOptions = {}) {
  const cwd = await resolveProjectRoot(
    options.cwd ?? process.cwd(),
    options.projectRoot,
  );
  const registration = await loadLocalRegistration(cwd);

  if (!registration) {
    throw new Error("No local habitat registration found. Run `habitat register --name \"<habitat name>\"` first.");
  }

  return { cwd, registration };
}

export async function listModules(options: RuntimeOptions = {}) {
  const { registration } = await loadRequiredRegistration(options);
  return registration.modules;
}

export async function listBlueprintCatalog(options: RuntimeOptions = {}): Promise<BlueprintCatalogResponse> {
  const cwd = await resolveProjectRoot(
    options.cwd ?? process.cwd(),
    options.projectRoot,
  );
  const config = await loadConfig(cwd);
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`${config.baseUrl}/catalog/blueprints`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${config.token}`,
    },
  });

  await assertOk(response, "Blueprint catalog request");
  const body = await parseJsonResponse(response);

  return {
    catalogVersion: String(body.catalogVersion ?? ""),
    blueprints: Array.isArray(body.blueprints) ? body.blueprints : [],
  };
}

export async function listResourceCatalog(options: RuntimeOptions = {}): Promise<ResourceCatalogResponse> {
  const cwd = await resolveProjectRoot(
    options.cwd ?? process.cwd(),
    options.projectRoot,
  );
  const config = await loadConfig(cwd);
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`${config.baseUrl}/catalog/resources`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${config.token}`,
    },
  });

  await assertOk(response, "Resource catalog request");
  const body = await parseJsonResponse(response);

  return {
    catalogVersion: String(body.catalogVersion ?? ""),
    resources: Array.isArray(body.resources) ? body.resources : [],
  };
}

export async function showBlueprint(id: string, options: RuntimeOptions = {}) {
  const cwd = await resolveProjectRoot(
    options.cwd ?? process.cwd(),
    options.projectRoot,
  );
  const config = await loadConfig(cwd);
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`${config.baseUrl}/catalog/blueprints/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${config.token}`,
    },
  });

  if (response.status === 404) {
    throw new Error(`Blueprint not found: ${id}`);
  }

  await assertOk(response, "Blueprint request");
  const body = await parseJsonResponse(response);

  return body.blueprint as ProductionBlueprint;
}

export async function getLocalStatusSummary(options: RuntimeOptions = {}) {
  const { registration } = await loadRequiredRegistration(options);

  return {
    currentTick: registration.currentTick,
    moduleCount: registration.modules.length,
    powerSummary: registration.powerSummary,
  };
}

function numericAttribute(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function powerDrawForModule(module: HabitatModule) {
  const status = String(module.runtimeAttributes.status ?? "offline");
  const powerDrawKw = module.runtimeAttributes.powerDrawKw;

  if (!powerDrawKw || typeof powerDrawKw !== "object" || Array.isArray(powerDrawKw)) {
    return 0;
  }

  return numericAttribute((powerDrawKw as JsonObject)[status]);
}

function assertRuntimeStatus(status: string): asserts status is RuntimeStatus {
  if (!(runtimeStatuses as readonly string[]).includes(status)) {
    throw new Error(`Status must be one of: ${runtimeStatuses.join(", ")}.`);
  }
}

function batteryModules(modules: HabitatModule[]) {
  return modules.filter(
    (module) =>
      typeof module.runtimeAttributes.currentEnergyKwh === "number" &&
      typeof module.runtimeAttributes.energyStorageKwh === "number",
  );
}

export async function tickHabitat(count: number, options: RuntimeOptions = {}) {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error("tick count must be a positive integer");
  }

  const { cwd, registration } = await loadRequiredRegistration(options);
  const startTick = registration.currentTick;
  const totalPowerDrawKw = registration.modules.reduce(
    (total, module) => total + powerDrawForModule(module),
    0,
  );
  const energyUsedKwh = (totalPowerDrawKw * count) / 3600;
  let energyRemainingToDrain = energyUsedKwh;

  for (const module of batteryModules(registration.modules)) {
    const currentEnergyKwh = numericAttribute(module.runtimeAttributes.currentEnergyKwh);
    const drainedKwh = Math.min(currentEnergyKwh, energyRemainingToDrain);

    module.runtimeAttributes.currentEnergyKwh = currentEnergyKwh - drainedKwh;
    energyRemainingToDrain -= drainedKwh;
  }

  const batteryEnergyKwh = batteryModules(registration.modules).reduce(
    (total, module) => total + numericAttribute(module.runtimeAttributes.currentEnergyKwh),
    0,
  );
  const batteryCapacityKwh = batteryModules(registration.modules).reduce(
    (total, module) => total + numericAttribute(module.runtimeAttributes.energyStorageKwh),
    0,
  );
  const result: TickSummary = {
    startTick,
    currentTick: startTick + count,
    ticksAdvanced: count,
    totalPowerDrawKw,
    energyUsedKwh,
    batteryEnergyKwh,
    batteryCapacityKwh,
    powerShortageKwh: energyRemainingToDrain,
  };

  registration.currentTick = result.currentTick;
  registration.powerSummary = {
    totalPowerDrawKw,
    energyUsedKwh,
    batteryEnergyKwh,
    batteryCapacityKwh,
    powerShortageKwh: energyRemainingToDrain,
  };
  registration.tickHistory.push(result);

  await saveLocalRegistration(cwd, registration);

  return result;
}

export async function showModule(id: string, options: RuntimeOptions = {}) {
  const { registration } = await loadRequiredRegistration(options);
  const module = registration.modules.find((entry) => entry.id === id);

  if (!module) {
    throw new Error(`Module not found: ${id}`);
  }

  return module;
}

export async function createModule(
  input: CreateModuleInput,
  options: ModuleCreateOptions = {},
) {
  const { cwd, registration } = await loadRequiredRegistration(options);
  const blueprint = registration.blueprints.find(
    (entry) => entry.blueprintId === input.blueprintId,
  );

  if (!blueprint) {
    throw new Error(`Blueprint not found: ${input.blueprintId}`);
  }

  if (blueprint.output?.itemType !== "module") {
    throw new Error(`Blueprint does not output a module: ${input.blueprintId}`);
  }

  const now = (options.now ?? (() => new Date()))().toISOString();
  const uuid = (options.randomUuid ?? randomUUID)();
  const id = `module_${uuid.replaceAll("-", "_")}`;
  const moduleType = String(blueprint.output.moduleType ?? blueprint.blueprintId);
  const module: HabitatModule = {
    id,
    habitatId: registration.habitatId,
    blueprintId: blueprint.blueprintId,
    moduleType,
    displayName: input.name ?? blueprint.displayName.replace(/\s+Blueprint$/, ""),
    connectedTo: [],
    runtimeAttributes: cloneJson(blueprint.runtimeAttributes ?? {}),
    capabilities: Array.isArray(blueprint.capabilities) ? [...blueprint.capabilities] : [],
    source: "local-blueprint",
    createdAt: now,
    updatedAt: now,
  };

  registration.modules.push(module);
  await saveLocalRegistration(cwd, registration);

  return module;
}

export async function updateModule(
  id: string,
  input: UpdateModuleInput,
  options: ModuleUpdateOptions = {},
) {
  if (!input.name && input.status === undefined && input.health === undefined) {
    throw new Error("Nothing to update. Use --name, --status, or --health.");
  }

  const { cwd, registration } = await loadRequiredRegistration(options);
  const module = registration.modules.find((entry) => entry.id === id);

  if (!module) {
    throw new Error(`Module not found: ${id}`);
  }

  if (input.name) {
    module.displayName = input.name;
  }

  if (input.status !== undefined) {
    module.runtimeAttributes.status = input.status;
  }

  if (input.health !== undefined) {
    module.runtimeAttributes.health = input.health;
  }

  module.updatedAt = (options.now ?? (() => new Date()))().toISOString();
  await saveLocalRegistration(cwd, registration);

  return module;
}

export async function setModuleStatus(
  id: string,
  status: string,
  options: RuntimeOptions = {},
) {
  assertRuntimeStatus(status);

  const { cwd, registration } = await loadRequiredRegistration(options);
  const module = registration.modules.find((entry) => entry.id === id);

  if (!module) {
    throw new Error(`Module not found: ${id}`);
  }

  module.runtimeAttributes.status = status;
  await saveLocalRegistration(cwd, registration);

  return module;
}

export async function deleteModule(id: string, options: RuntimeOptions = {}) {
  const { cwd, registration } = await loadRequiredRegistration(options);
  const nextModules = registration.modules.filter((entry) => entry.id !== id);

  if (nextModules.length === registration.modules.length) {
    throw new Error(`Module not found: ${id}`);
  }

  registration.modules = nextModules;
  await saveLocalRegistration(cwd, registration);
}

export async function getRegistrationStatus(options: RuntimeOptions = {}) {
  const cwd = await resolveProjectRoot(
    options.cwd ?? process.cwd(),
    options.projectRoot,
  );
  const registration = await loadLocalRegistration(cwd);

  if (!registration) {
    throw new Error("No local habitat registration found. Run `habitat register --name \"<habitat name>\"` first.");
  }

  const config = await loadConfig(cwd);
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(
    `${config.baseUrl}/habitats/${encodeURIComponent(registration.habitatId)}/registration`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.token}`,
      },
    },
  );

  await assertOk(response, "Status request");
  return (await parseJsonResponse(response)) as HabitatStatus;
}

export async function unregisterHabitat(options: RuntimeOptions = {}) {
  const cwd = await resolveProjectRoot(
    options.cwd ?? process.cwd(),
    options.projectRoot,
  );
  const registration = await loadLocalRegistration(cwd);

  if (!registration) {
    throw new Error("No local habitat registration found. Nothing to unregister.");
  }

  const config = await loadConfig(cwd);
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(
    `${config.baseUrl}/habitats/${encodeURIComponent(registration.habitatId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${config.token}`,
      },
    },
  );

  await assertOk(response, "Unregister");
  await deleteLocalRegistration(cwd);

  return {
    habitatId: registration.habitatId,
  };
}
