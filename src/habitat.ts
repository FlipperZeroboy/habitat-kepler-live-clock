import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getLocalStateStore,
  getDatabaseFilePath,
} from "./local-state";
import {
  acknowledgeAlert as acknowledgeStoredAlert,
  listAlerts as listStoredAlerts,
  observeAlert,
  resolveAlertCondition,
  type HabitatAlert,
} from "./alerts";
export type { HabitatAlert } from "./alerts";
export { getDatabaseFilePath } from "./local-state";

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

export type StarterHuman = {
  id: string;
  displayName: string;
  locationModuleId: string;
};

export type AlertContract = {
  schemaVersion: string;
  schema: JsonObject;
};

export type RegistrationContracts = {
  alerts: AlertContract;
};

export type EvaState = {
  deployedHumanId: string | null;
  position: { x: number; y: number };
  carriedResources: Record<string, number>;
  maxCarryCapacityKg: number;
};

export type ClockMode = "manual" | "kepler";
export type ConnectionStatus = "connected" | "connecting" | "disconnected" | "error";

export type StreamMetadata = {
  protocolVersion: string;
  subscriptions: string[];
  currentTick: number;
  tickIntervalMs: number;
  ticksPerPulse: number;
  status: "paused" | "running" | string;
};

export type ClockState = {
  mode: ClockMode;
  connected: boolean;
  connectionStatus: ConnectionStatus;
  lastKeplerTick: number | null;
  lastAdvancedBy: number | null;
  lastConnectedAt: string | null;
  lastMessageAt: string | null;
  lastConnectionError: string | null;
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
  solarGeneratedKwh: number;
  solarChargedKwh: number;
  solarChargingReason: string;
  completedConstructionJobs: ConstructionCompletion[];
};

export type InventoryCheck = {
  resource: string;
  required: number;
  available: number;
  sufficient: boolean;
};

export type ConstructionDryRun = {
  blueprintId: string;
  blueprintStatus: string;
  buildable: boolean;
  facilityRequirement: JsonObject;
  facility?: HabitatModule;
  facilityExists: boolean;
  facilityAvailable: boolean;
  supplyCache?: HabitatModule;
  supplyCacheOnline: boolean;
  prerequisites: string[];
  missingPrerequisites: string[];
  prerequisitesMet: boolean;
  inventoryChecks: InventoryCheck[];
  inventorySufficient: boolean;
  moduleToCreate: JsonObject;
  resourcesToSpend: JsonObject;
  buildTicks?: number;
  runtimeAttributes: JsonObject;
  capabilities: string[];
  hasUsablePower: boolean;
  canStart: boolean;
};

export type ConstructionJob = {
  id: string;
  blueprintId: string;
  outputModuleId: string;
  output: JsonObject;
  buildTicks: number;
  remainingTicks: number;
  runtimeAttributes: JsonObject;
  capabilities: string[];
  status: "active";
  startedAt: string;
};

export type ConstructionStart = {
  job: ConstructionJob;
  facility: HabitatModule;
};

export type ConstructionJobStatus = {
  facilityId: string;
  facilityName: string;
  job: ConstructionJob;
};

export type ConstructionCancelResult = {
  facilityId: string;
  facilityName: string;
  jobId: string;
  blueprintId: string;
  outputModuleId: string;
};

export type ConstructionCompletion = {
  jobId: string;
  blueprintId: string;
  outputModuleId: string;
  outputModuleType: string;
  facilityId: string;
  facilityName: string;
};

export type InventoryEntry = {
  resource: string;
  quantity: number;
};

export type InventoryAddResult = InventoryEntry & {
  added: number;
  storageModuleId: string;
  storageModuleName: string;
};

export type InventoryRemoveResult = InventoryEntry & {
  removed: number;
  storageModuleId: string;
  storageModuleName: string;
};

export type LocalRegistration = {
  habitatUuid: string;
  habitatId: string;
  displayName: string;
  registeredAt: string;
  currentTick: number;
  starterModules: StarterModule[];
  starterHumans?: StarterHuman[];
  contracts?: RegistrationContracts;
  evaState?: EvaState;
  blueprints: ProductionBlueprint[];
  modules: HabitatModule[];
  powerSummary: PowerSummary;
  tickHistory: TickSummary[];
  alerts?: HabitatAlert[];
  streamUrl?: string;
  apiToken?: string;
  stream?: StreamMetadata;
  clock?: ClockState;
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

export type SolarIrradianceStatus = {
  solarIrradiance: {
    wPerM2: number;
    condition: string;
  };
};

export type WorldScanProbability = {
  resourceType: string | null;
  probabilityPct: number;
};

export type WorldScanQuantityEstimate = {
  resourceType: string;
  unit: "kg";
  estimatedKg: number;
  minimumKg: number;
  maximumKg: number;
  exact: boolean;
  estimatedValue?: number;
};

export type WorldScanTile = {
  x: number;
  y: number;
  terrain: string;
  distanceTiles: number;
  probabilities: WorldScanProbability[];
  topCandidate: WorldScanProbability;
  quantityEstimate: WorldScanQuantityEstimate | null;
};

export type WorldScanResponse = {
  scan: {
    modelVersion: string;
    origin: { x: number; y: number };
    sensorStrength: number;
    radiusTiles: number;
    tiles: WorldScanTile[];
  };
};

export type ConfigCheck = {
  baseUrl: string;
  tokenLoaded: boolean;
  databaseFile: string;
};

type RuntimeOptions = {
  cwd?: string;
  fetchImpl?: FetchLike;
  projectRoot?: string;
};

export type WorldScanOptions = RuntimeOptions & {
  sensorStrength: number;
  radiusTiles: number;
};

export type WorldCollection = {
  x: number;
  y: number;
  resourceType: string;
  unit: "kg";
  collectedKg: number;
  remainingKg: number;
};

export type CollectionResult = {
  collection: WorldCollection;
  eva: EvaState;
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

type ConstructionOptions = RuntimeOptions & {
  randomUuid?: () => string;
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
const defaultEvaCapacityKg = 10;
const minSectorCoordinate = -25;
const maxSectorCoordinate = 24;

function createDefaultEvaState(): EvaState {
  return {
    deployedHumanId: null,
    position: { x: 0, y: 0 },
    carriedResources: {},
    maxCarryCapacityKg: defaultEvaCapacityKg,
  };
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
    databaseFile: getDatabaseFilePath(cwd),
  };
}

export async function loadLocalRegistration(cwd = process.cwd()) {
  return getLocalStateStore(cwd).load();
}

function cloneJson<T>(value: T): T {
  return structuredClone(value);
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

function hydrateStarterHumans(value: unknown): StarterHuman[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((human, index) => {
    if (
      !human ||
      typeof human !== "object" ||
      typeof (human as Record<string, unknown>).id !== "string" ||
      typeof (human as Record<string, unknown>).displayName !== "string" ||
      typeof (human as Record<string, unknown>).locationModuleId !== "string" ||
      !(human as Record<string, unknown>).id ||
      !(human as Record<string, unknown>).displayName ||
      !(human as Record<string, unknown>).locationModuleId
    ) {
      throw new Error(`Registration starter human ${index + 1} is invalid.`);
    }

    const starterHuman = human as StarterHuman;
    return {
      id: starterHuman.id,
      displayName: starterHuman.displayName,
      locationModuleId: starterHuman.locationModuleId,
    };
  });
}

async function saveLocalRegistration(cwd: string, registration: LocalRegistration) {
  await getLocalStateStore(cwd).save(registration);
}

async function deleteLocalRegistration(cwd: string) {
  await getLocalStateStore(cwd).delete();
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
    streamUrl: body.streamUrl,
    apiToken: body.apiToken,
    stream: body.stream,
    ...(body.streamUrl && body.apiToken && body.stream ? {
      clock: {
        mode: "manual",
        connected: false,
        connectionStatus: "disconnected",
        lastKeplerTick: null,
        lastAdvancedBy: null,
        lastConnectedAt: null,
        lastMessageAt: null,
        lastConnectionError: null,
      },
    } : {}),
    starterModules,
    starterHumans: hydrateStarterHumans(body.starterHumans),
    contracts: body.contracts?.alerts
      ? { alerts: body.contracts.alerts }
      : undefined,
    blueprints: Array.isArray(body.blueprints) ? body.blueprints : [],
    modules: hydrateStarterModules(body.habitatId, starterModules, registeredAt),
    alerts: [],
    powerSummary: {
      totalPowerDrawKw: 0,
      energyUsedKwh: 0,
      batteryEnergyKwh: 0,
      batteryCapacityKwh: 0,
      powerShortageKwh: 0,
    },
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

export async function listHumans(options: RuntimeOptions = {}): Promise<StarterHuman[]> {
  const { registration } = await loadRequiredRegistration(options);
  return registration.starterHumans ?? [];
}

export async function listAlerts(options: RuntimeOptions = {}): Promise<HabitatAlert[]> {
  const { registration } = await loadRequiredRegistration(options);
  return listStoredAlerts(registration);
}

export async function acknowledgeAlert(id: string, options: RuntimeOptions = {}): Promise<HabitatAlert> {
  const { cwd, registration } = await loadRequiredRegistration(options);
  const alert = acknowledgeStoredAlert(registration, id);
  await saveLocalRegistration(cwd, registration);
  return alert;
}

export async function moveHuman(
  humanId: string,
  moduleId: string,
  options: RuntimeOptions = {},
): Promise<StarterHuman> {
  const { cwd, registration } = await loadRequiredRegistration(options);
  const humans = registration.starterHumans ?? [];
  const human = humans.find((entry) => entry.id === humanId);

  if (!human) {
    throw new Error(`Human not found: ${humanId}`);
  }

  const destination = registration.modules.find((module) => module.id === moduleId);

  if (!destination) {
    throw new Error(`Module not found: ${moduleId}`);
  }

  if (human.locationModuleId !== destination.id) {
    const crewCapacity = numericAttribute(destination.runtimeAttributes.crewCapacity);
    const occupants = humans.filter((entry) => entry.locationModuleId === destination.id).length;

    if (occupants >= crewCapacity) {
      throw new Error(`Module ${destination.displayName} has reached crew capacity.`);
    }
  }

  human.locationModuleId = destination.id;
  await saveLocalRegistration(cwd, registration);
  return human;
}

function currentEvaState(registration: LocalRegistration): EvaState {
  return registration.evaState
    ? cloneJson(registration.evaState)
    : createDefaultEvaState();
}

export async function getEvaStatus(options: RuntimeOptions = {}): Promise<EvaState> {
  const { cwd, registration } = await loadRequiredRegistration(options);
  const eva = currentEvaState(registration);
  if (eva.deployedHumanId) {
    observeAlert(registration, {
      code: "human-deployed-outside",
      title: "Human deployed outside habitat",
      description: "A human is currently deployed beyond the habitat suitport.",
      severity: "warning",
      source: "eva",
      subject: { type: "human", id: eva.deployedHumanId },
    });
    if (Object.values(eva.carriedResources).reduce((total, value) => total + value, 0) >= eva.maxCarryCapacityKg) {
      observeAlert(registration, {
        code: "eva-carry-capacity-reached",
        title: "Explorer carrying capacity reached",
        description: "The deployed explorer is carrying the maximum allowed material.",
        severity: "warning",
        source: "eva",
        subject: { type: "human", id: eva.deployedHumanId },
      });
    }
    registration.evaState = eva;
    await saveLocalRegistration(cwd, registration);
  }
  return eva;
}

export async function deployHuman(humanId: string, options: RuntimeOptions = {}): Promise<EvaState> {
  const { cwd, registration } = await loadRequiredRegistration(options);
  const state = currentEvaState(registration);

  if (state.deployedHumanId) {
    throw new Error(`Human ${state.deployedHumanId} is already deployed.`);
  }

  const human = (registration.starterHumans ?? []).find((entry) => entry.id === humanId);
  if (!human) {
    throw new Error(`Human not found: ${humanId}`);
  }

  const suitport = registration.modules.find((module) =>
    (module.capabilities.includes("limited-eva") || module.moduleType === "basic-suitport") &&
    isOnlineStatus(module.runtimeAttributes.status),
  );

  if (!suitport || human.locationModuleId !== suitport.id) {
    throw new Error("Human must occupy an active suitport before deployment.");
  }

  state.deployedHumanId = human.id;
  state.position = { x: 0, y: 0 };
  state.carriedResources = {};
  registration.evaState = state;
  observeAlert(registration, {
    code: "human-deployed-outside",
    title: "Human deployed outside habitat",
    description: "A human is currently deployed beyond the habitat suitport.",
    severity: "warning",
    source: "eva",
    subject: { type: "human", id: human.id },
  });
  await saveLocalRegistration(cwd, registration);
  return state;
}

export async function moveExplorer(x: number, y: number, options: RuntimeOptions = {}): Promise<EvaState> {
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    throw new Error("Explorer position must use integer coordinates.");
  }

  const { cwd, registration } = await loadRequiredRegistration(options);
  const state = currentEvaState(registration);
  if (!state.deployedHumanId) {
    throw new Error("No human is currently deployed.");
  }

  const distance = Math.abs(x - state.position.x) + Math.abs(y - state.position.y);
  if (distance !== 1) {
    throw new Error("Explorer movement must be exactly one adjacent grid tile.");
  }

  if (x < minSectorCoordinate || x > maxSectorCoordinate || y < minSectorCoordinate || y > maxSectorCoordinate) {
    throw new Error("Explorer destination is outside the current Kepler sector.");
  }

  state.position = { x, y };
  registration.evaState = state;
  await saveLocalRegistration(cwd, registration);
  return state;
}

export async function dockExplorer(options: RuntimeOptions = {}): Promise<EvaState> {
  const { cwd, registration } = await loadRequiredRegistration(options);
  const state = currentEvaState(registration);
  if (!state.deployedHumanId) {
    throw new Error("No human is currently deployed.");
  }

  if (state.position.x !== 0 || state.position.y !== 0) {
    throw new Error("Explorer can only dock at (0, 0).");
  }

  const human = (registration.starterHumans ?? []).find((entry) => entry.id === state.deployedHumanId);
  if (!human) {
    throw new Error(`Deployed human not found: ${state.deployedHumanId}`);
  }
  const suitport = registration.modules.find((module) =>
    module.capabilities.includes("limited-eva") || module.moduleType === "basic-suitport",
  );
  if (!suitport) {
    throw new Error("No suitport module is available for docking.");
  }
  const storageModule = registration.modules.find((module) => isStorageModule(module));
  if (Object.keys(state.carriedResources).length > 0 && !storageModule) {
    throw new Error("No storage module is available to unload carried resources.");
  }

  if (storageModule) {
    const storedResources = parseStoredResources(storageModule);
    for (const [resource, quantity] of Object.entries(state.carriedResources)) {
      storedResources[resource] = numericAttribute(storedResources[resource]) + quantity;
    }
    storageModule.runtimeAttributes.storedResources = storedResources;
  }

  state.deployedHumanId = null;
  state.carriedResources = {};
  human.locationModuleId = suitport.id;
  state.position = { x: 0, y: 0 };
  resolveAlertCondition(registration, "human-deployed-outside", { type: "human", id: human.id });
  resolveAlertCondition(registration, "eva-carry-capacity-reached", { type: "human", id: human.id });
  registration.evaState = state;
  await saveLocalRegistration(cwd, registration);
  return state;
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

export async function scanHabitat(options: WorldScanOptions): Promise<WorldScanResponse> {
  if (!Number.isInteger(options.sensorStrength) || options.sensorStrength < 0 || options.sensorStrength > 100) {
    throw new Error("sensor strength must be an integer between 0 and 100");
  }
  if (!Number.isInteger(options.radiusTiles) || options.radiusTiles < 0 || options.radiusTiles > 5) {
    throw new Error("scan radius must be an integer between 0 and 5");
  }

  const cwd = await resolveProjectRoot(options.cwd ?? process.cwd(), options.projectRoot);
  const { registration } = await loadRequiredRegistration({ cwd, projectRoot: options.projectRoot });
  const eva = currentEvaState(registration);
  if (!eva.deployedHumanId) {
    throw new Error("No human is currently deployed. Deploy a human before scanning.");
  }
  const config = await loadConfig(cwd);
  const query = new URLSearchParams({
    habitatId: registration.habitatId,
    x: String(eva.position.x),
    y: String(eva.position.y),
    sensorStrength: String(options.sensorStrength),
    radiusTiles: String(options.radiusTiles),
  });
  const response = await (options.fetchImpl ?? fetch)(`${config.baseUrl}/world/scan?${query}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${config.token}` },
  });

  await assertOk(response, "World scan request");
  return (await parseJsonResponse(response)) as WorldScanResponse;
}

export async function collectResource(quantityKg: number, options: RuntimeOptions = {}): Promise<CollectionResult> {
  if (!Number.isInteger(quantityKg) || quantityKg <= 0) {
    throw new Error("Collection quantity must be a positive whole number.");
  }

  const cwd = await resolveProjectRoot(options.cwd ?? process.cwd(), options.projectRoot);
  const { registration } = await loadRequiredRegistration({ cwd, projectRoot: options.projectRoot });
  const eva = currentEvaState(registration);
  if (!eva.deployedHumanId) {
    throw new Error("No human is currently deployed. Deploy a human before collecting.");
  }

  const carriedKg = Object.values(eva.carriedResources).reduce((total, quantity) => total + quantity, 0);
  if (carriedKg + quantityKg > eva.maxCarryCapacityKg) {
    throw new Error(`Carrying capacity exceeded: only ${eva.maxCarryCapacityKg - carriedKg} kg remains.`);
  }

  const config = await loadConfig(cwd);
  let body: { collection: WorldCollection };
  try {
    const response = await (options.fetchImpl ?? fetch)(`${config.baseUrl}/world/collect`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        habitatId: registration.habitatId,
        x: eva.position.x,
        y: eva.position.y,
        quantityKg,
      }),
    });
    await assertOk(response, "World collection request");
    body = await parseJsonResponse(response) as { collection: WorldCollection };
  } catch (error) {
    observeAlert(registration, {
      code: "collection-failed",
      title: "Material collection failed",
      description: error instanceof Error ? error.message : "Kepler rejected the material collection attempt.",
      severity: "warning",
      source: "collection",
      subject: { type: "human", id: eva.deployedHumanId },
    });
    await saveLocalRegistration(cwd, registration);
    throw error;
  }
  const collection = body.collection;
  if (!collection || typeof collection.resourceType !== "string" || collection.collectedKg !== quantityKg) {
    throw new Error("Kepler returned an invalid collection response.");
  }

  eva.carriedResources[collection.resourceType] =
    (eva.carriedResources[collection.resourceType] ?? 0) + collection.collectedKg;
  resolveAlertCondition(registration, "collection-failed", { type: "human", id: eva.deployedHumanId });
  if (Object.values(eva.carriedResources).reduce((total, value) => total + value, 0) >= eva.maxCarryCapacityKg) {
    observeAlert(registration, {
      code: "eva-carry-capacity-reached",
      title: "Explorer carrying capacity reached",
      description: "The deployed explorer is carrying the maximum allowed material.",
      severity: "warning",
      source: "eva",
      subject: { type: "human", id: eva.deployedHumanId },
    });
  }
  registration.evaState = eva;
  await saveLocalRegistration(cwd, registration);
  return { collection, eva };
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
  const summary = {
    currentTick: registration.currentTick,
    moduleCount: registration.modules.length,
    powerSummary: registration.powerSummary,
  };
  if (!registration.streamUrl && !registration.apiToken && !registration.stream && !registration.clock) {
    return summary;
  }
  return {
    ...summary,
    streamUrl: registration.streamUrl ?? null,
    apiToken: registration.apiToken ?? null,
    stream: registration.stream ?? null,
    clock: registration.clock ?? createDefaultClockState(),
  };
}

export function createDefaultClockState(): ClockState {
  return {
    mode: "manual",
    connected: false,
    connectionStatus: "disconnected",
    lastKeplerTick: null,
    lastAdvancedBy: null,
    lastConnectedAt: null,
    lastMessageAt: null,
    lastConnectionError: null,
  };
}

export async function getClockState(options: RuntimeOptions = {}): Promise<ClockState> {
  const { registration } = await loadRequiredRegistration(options);
  return registration.clock ?? createDefaultClockState();
}

export async function setClockListening(enabled: boolean, options: RuntimeOptions = {}): Promise<ClockState> {
  const { cwd, registration } = await loadRequiredRegistration(options);
  registration.clock = {
    ...(registration.clock ?? createDefaultClockState()),
    mode: enabled ? "kepler" : "manual",
    connected: false,
    connectionStatus: enabled ? "connecting" : "disconnected",
    lastConnectionError: null,
  };
  await saveLocalRegistration(cwd, registration);
  return registration.clock;
}

export async function recordClockConnection(options: RuntimeOptions = {}): Promise<ClockState> {
  const { cwd, registration } = await loadRequiredRegistration(options);
  registration.clock = {
    ...(registration.clock ?? createDefaultClockState()),
    connected: true,
    connectionStatus: "connected",
    lastConnectedAt: new Date().toISOString(),
    lastConnectionError: null,
  };
  await saveLocalRegistration(cwd, registration);
  return registration.clock;
}

export async function recordClockError(message: string, options: RuntimeOptions = {}): Promise<ClockState> {
  const { cwd, registration } = await loadRequiredRegistration(options);
  registration.clock = {
    ...(registration.clock ?? createDefaultClockState()),
    connected: false,
    connectionStatus: "error",
    lastConnectionError: message,
  };
  await saveLocalRegistration(cwd, registration);
  return registration.clock;
}

export async function applyKeplerTick(
  tick: number,
  advancedBy: number,
  messageAt: string,
  options: RuntimeOptions = {},
): Promise<TickSummary | null> {
  const { cwd, registration } = await loadRequiredRegistration(options);
  const clock = registration.clock ?? createDefaultClockState();
  if (clock.mode !== "kepler") return null;
  if (!Number.isInteger(advancedBy) || advancedBy <= 0) {
    throw new Error("Kepler advancedBy must be a positive integer.");
  }

  const summary = await tickHabitat(advancedBy, options);
  const freshRegistration = await loadLocalRegistration(cwd);
  if (!freshRegistration) return summary;
  freshRegistration.clock = {
    ...(freshRegistration.clock ?? createDefaultClockState()),
    lastKeplerTick: tick,
    lastAdvancedBy: advancedBy,
    lastMessageAt: messageAt,
    lastConnectionError: null,
  };
  await saveLocalRegistration(cwd, freshRegistration);
  return summary;
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

function onlineBatteryModules(modules: HabitatModule[]) {
  return batteryModules(modules).filter((module) => isOnlineStatus(module.runtimeAttributes.status));
}

function isOnlineStatus(status: unknown) {
  return status !== "offline" && status !== "damaged";
}

function solarGenerationModules(modules: HabitatModule[]) {
  return modules.filter(
    (module) =>
      isOnlineStatus(module.runtimeAttributes.status) &&
      numericAttribute(module.runtimeAttributes.powerGenerationKw) > 0 &&
      (module.capabilities.includes("solar-generation") || module.moduleType.includes("solar")),
  );
}

function chargeBatteryModules(modules: HabitatModule[], generatedKwh: number) {
  let energyRemainingToStore = generatedKwh;

  for (const module of onlineBatteryModules(modules)) {
    const currentEnergyKwh = numericAttribute(module.runtimeAttributes.currentEnergyKwh);
    const energyStorageKwh = numericAttribute(module.runtimeAttributes.energyStorageKwh);
    const availableCapacityKwh = Math.max(0, energyStorageKwh - currentEnergyKwh);
    const storedKwh = Math.min(availableCapacityKwh, energyRemainingToStore);

    if (storedKwh <= 0) {
      continue;
    }

    module.runtimeAttributes.currentEnergyKwh = currentEnergyKwh + storedKwh;
    energyRemainingToStore -= storedKwh;

    if (energyRemainingToStore <= 0) {
      break;
    }
  }

  return generatedKwh - energyRemainingToStore;
}

type SolarChargingResult = {
  generatedKwh: number;
  chargedKwh: number;
  reason: string;
};

async function generateSolarChargeKwh(
  modules: HabitatModule[],
  ticksAdvanced: number,
  options: RuntimeOptions = {},
): Promise<SolarChargingResult> {
  const solarModules = solarGenerationModules(modules);
  const chargeableBatteries = onlineBatteryModules(modules);

  if (solarModules.length === 0) {
    return { generatedKwh: 0, chargedKwh: 0, reason: "no online solar modules" };
  }

  if (chargeableBatteries.length === 0) {
    return { generatedKwh: 0, chargedKwh: 0, reason: "no online battery modules" };
  }

  let solar: SolarIrradianceStatus;
  try {
    solar = await getSolarIrradiance(options);
  } catch {
    return { generatedKwh: 0, chargedKwh: 0, reason: "solar irradiance could not be read from Kepler" };
  }

  const irradiance = solar.solarIrradiance.wPerM2;

  if (!Number.isFinite(irradiance) || irradiance <= 0) {
    return { generatedKwh: 0, chargedKwh: 0, reason: "no usable solar irradiance was reported by Kepler" };
  }

  const totalSolarGenerationKw = solarModules.reduce(
    (total, module) => total + numericAttribute(module.runtimeAttributes.powerGenerationKw),
    0,
  );
  const solarMultiplier = irradiance / 900;
  const solarEfficiency = 0.5;

  const generatedKwh = (totalSolarGenerationKw * solarMultiplier * solarEfficiency * ticksAdvanced) / 3600;
  return { generatedKwh, chargedKwh: 0, reason: "Solar charging completed." };
}

function isStorageModule(module: HabitatModule) {
  return module.moduleType === "supply-cache" ||
    module.moduleType.includes("logistics") ||
    module.capabilities.includes("storage");
}

function moduleMatchesPrerequisite(module: HabitatModule, prerequisite: string) {
  return module.blueprintId === prerequisite ||
    module.moduleType === prerequisite ||
    module.capabilities.includes(prerequisite);
}

function numericRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as JsonObject)
      .filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1])),
  );
}

function inventoryFromStorage(modules: HabitatModule[]) {
  const inventory: Record<string, number> = {};

  for (const module of modules.filter((entry) => isStorageModule(entry))) {
    for (const [resource, quantity] of Object.entries(numericRecord(module.runtimeAttributes.storedResources))) {
      inventory[resource] = (inventory[resource] ?? 0) + quantity;
    }
  }

  return inventory;
}

function hasUsablePower(modules: HabitatModule[]) {
  return modules.some((module) => numericAttribute(module.runtimeAttributes.currentEnergyKwh) > 0) ||
    modules.some((module) => numericAttribute(module.runtimeAttributes.powerGenerationKw) > 0);
}

function constructionReadiness(
  blueprintId: string,
  blueprint: ProductionBlueprint,
  registration: LocalRegistration,
): ConstructionDryRun {
  const facilityRequirement = blueprint.requiredFacility ?? {};
  const requiredFacilityType = typeof facilityRequirement.moduleType === "string"
    ? facilityRequirement.moduleType
    : undefined;
  const facility = requiredFacilityType
    ? registration.modules.find((module) => module.moduleType === requiredFacilityType)
    : undefined;
  const facilityExists = requiredFacilityType ? Boolean(facility) : true;
  const facilityAvailable = requiredFacilityType
    ? Boolean(facility && facility.runtimeAttributes.status === "idle")
    : true;
  const supplyCache = registration.modules.find((module) => isStorageModule(module));
  const supplyCacheOnline = Boolean(supplyCache && isOnlineStatus(supplyCache.runtimeAttributes.status));
  const prerequisites = Array.isArray(blueprint.prerequisites) ? blueprint.prerequisites : [];
  const missingPrerequisites = prerequisites.filter(
    (prerequisite) => !registration.modules.some((module) => moduleMatchesPrerequisite(module, prerequisite)),
  );
  const inventory = inventoryFromStorage(registration.modules);
  const resourcesToSpend = numericRecord(blueprint.inputs);
  const inventoryChecks = Object.entries(resourcesToSpend)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([resource, required]) => {
      const available = inventory[resource] ?? 0;

      return {
        resource,
        required,
        available,
        sufficient: available >= required,
      };
    });
  const buildable = blueprint.status === "published" && blueprint.output?.itemType === "module";
  const inventorySufficient = inventoryChecks.every((check) => check.sufficient);
  const prerequisitesMet = missingPrerequisites.length === 0;
  const usablePower = hasUsablePower(registration.modules);

  return {
    blueprintId,
    blueprintStatus: String(blueprint.status ?? "unknown"),
    buildable,
    facilityRequirement,
    facility,
    facilityExists,
    facilityAvailable,
    supplyCache,
    supplyCacheOnline,
    prerequisites,
    missingPrerequisites,
    prerequisitesMet,
    inventoryChecks,
    inventorySufficient,
    moduleToCreate: cloneJson(blueprint.output ?? {}),
    resourcesToSpend,
    buildTicks: blueprint.buildTicks,
    runtimeAttributes: cloneJson(blueprint.runtimeAttributes ?? {}),
    capabilities: Array.isArray(blueprint.capabilities) ? [...blueprint.capabilities] : [],
    hasUsablePower: usablePower,
    canStart: buildable &&
      facilityExists &&
      facilityAvailable &&
      supplyCacheOnline &&
      prerequisitesMet &&
      inventorySufficient &&
      usablePower,
  };
}

function constructionBlockers(readiness: ConstructionDryRun) {
  return [
    !readiness.buildable ? "blueprint is not a published module blueprint" : undefined,
    !readiness.facilityExists ? "required facility is missing" : undefined,
    !readiness.facilityAvailable ? "required facility is not available" : undefined,
    !readiness.supplyCacheOnline ? "supply cache or logistics module is not online" : undefined,
    !readiness.prerequisitesMet ? `missing prerequisites: ${readiness.missingPrerequisites.join(", ")}` : undefined,
    !readiness.inventorySufficient ? "inventory is missing required resources" : undefined,
    !readiness.hasUsablePower ? "habitat has no usable power" : undefined,
  ].filter((reason): reason is string => Boolean(reason));
}

function spendResourcesFromStorage(modules: HabitatModule[], resourcesToSpend: JsonObject) {
  for (const [resource, required] of Object.entries(numericRecord(resourcesToSpend))) {
    let remaining = required;

    for (const module of modules.filter((entry) => isStorageModule(entry) && isOnlineStatus(entry.runtimeAttributes.status))) {
      const storedResources = module.runtimeAttributes.storedResources;

      if (!storedResources || typeof storedResources !== "object" || Array.isArray(storedResources)) {
        continue;
      }

      const resources = storedResources as JsonObject;
      const available = numericAttribute(resources[resource]);
      const spent = Math.min(available, remaining);

      if (spent <= 0) {
        continue;
      }

      resources[resource] = available - spent;
      remaining -= spent;

      if (remaining === 0) {
        break;
      }
    }
  }
}

function onlineStorageModules(modules: HabitatModule[]) {
  return modules.filter((module) => isStorageModule(module) && isOnlineStatus(module.runtimeAttributes.status));
}

function aggregateInventory(modules: HabitatModule[]): InventoryEntry[] {
  const inventory = inventoryFromStorage(modules);

  return Object.entries(inventory)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([resource, quantity]) => ({ resource, quantity }));
}

function parseStoredResources(module: HabitatModule) {
  const storedResources = module.runtimeAttributes.storedResources;

  if (!storedResources || typeof storedResources !== "object" || Array.isArray(storedResources)) {
    module.runtimeAttributes.storedResources = {};
  }

  return module.runtimeAttributes.storedResources as JsonObject;
}

function isConstructionJob(value: unknown): value is ConstructionJob {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const job = value as JsonObject;

  return typeof job.id === "string" &&
    typeof job.blueprintId === "string" &&
    typeof job.outputModuleId === "string" &&
    typeof job.buildTicks === "number" &&
    typeof job.remainingTicks === "number" &&
    job.status === "active";
}

function displayNameFromModuleType(moduleType: string) {
  return moduleType
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function advanceConstructionJobs(
  registration: LocalRegistration,
  ticksAdvanced: number,
  completedAt: string,
) {
  const completedJobs: ConstructionCompletion[] = [];

  for (const module of registration.modules) {
    const job = module.runtimeAttributes.constructionJob;

    if (!isConstructionJob(job)) {
      continue;
    }

    job.remainingTicks = Math.max(0, job.remainingTicks - ticksAdvanced);

    if (job.remainingTicks > 0) {
      continue;
    }

    const moduleType = typeof job.output.moduleType === "string"
      ? job.output.moduleType
      : job.blueprintId;
    const outputModule: HabitatModule = {
      id: job.outputModuleId,
      habitatId: registration.habitatId,
      blueprintId: job.blueprintId,
      moduleType,
      displayName: displayNameFromModuleType(moduleType),
      connectedTo: [],
      runtimeAttributes: cloneJson(job.runtimeAttributes),
      capabilities: [...job.capabilities],
      source: "local-blueprint",
      createdAt: completedAt,
      updatedAt: completedAt,
    };

    registration.modules.push(outputModule);
    module.runtimeAttributes.status = "idle";
    delete module.runtimeAttributes.constructionJob;
    module.updatedAt = completedAt;

    completedJobs.push({
      jobId: job.id,
      blueprintId: job.blueprintId,
      outputModuleId: job.outputModuleId,
      outputModuleType: moduleType,
      facilityId: module.id,
      facilityName: module.displayName,
    });
  }

  return completedJobs;
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

  const solarCharging = await generateSolarChargeKwh(registration.modules, count, options);
  solarCharging.chargedKwh = chargeBatteryModules(registration.modules, solarCharging.generatedKwh);
  if (solarCharging.generatedKwh > 0 && solarCharging.chargedKwh === 0) {
    solarCharging.reason = "all online batteries were full";
  } else if (solarCharging.chargedKwh < solarCharging.generatedKwh) {
    solarCharging.reason = "solar generation was capped by available battery capacity";
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
    solarGeneratedKwh: solarCharging.generatedKwh,
    solarChargedKwh: solarCharging.chargedKwh,
    solarChargingReason: solarCharging.reason,
    completedConstructionJobs: [],
  };
  result.completedConstructionJobs = advanceConstructionJobs(
    registration,
    count,
    new Date().toISOString(),
  );

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
  const blueprint = await showBlueprint(input.blueprintId, options);

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

export async function dryRunConstruction(
  blueprintId: string,
  options: RuntimeOptions = {},
): Promise<ConstructionDryRun> {
  const [blueprint, { registration }] = await Promise.all([
    showBlueprint(blueprintId, options),
    loadRequiredRegistration(options),
  ]);

  return constructionReadiness(blueprintId, blueprint, registration);
}

export async function startConstruction(
  blueprintId: string,
  options: ConstructionOptions = {},
): Promise<ConstructionStart> {
  const [blueprint, { cwd, registration }] = await Promise.all([
    showBlueprint(blueprintId, options),
    loadRequiredRegistration(options),
  ]);
  const readiness = constructionReadiness(blueprintId, blueprint, registration);

  if (!readiness.canStart) {
    throw new Error(`Construction cannot start: ${constructionBlockers(readiness).join("; ")}.`);
  }

  if (!readiness.facility) {
    throw new Error("Construction cannot start: required facility is missing.");
  }

  const now = (options.now ?? (() => new Date()))().toISOString();
  const uuid = (options.randomUuid ?? randomUUID)().replaceAll("-", "_");
  const buildTicks = typeof blueprint.buildTicks === "number" ? blueprint.buildTicks : 0;
  const job: ConstructionJob = {
    id: `construction_${uuid}`,
    blueprintId,
    outputModuleId: `module_${uuid}`,
    output: cloneJson(blueprint.output ?? {}),
    buildTicks,
    remainingTicks: buildTicks,
    runtimeAttributes: cloneJson(blueprint.runtimeAttributes ?? {}),
    capabilities: Array.isArray(blueprint.capabilities) ? [...blueprint.capabilities] : [],
    status: "active",
    startedAt: now,
  };

  spendResourcesFromStorage(registration.modules, readiness.resourcesToSpend);
  readiness.facility.runtimeAttributes.status = "active";
  readiness.facility.runtimeAttributes.constructionJob = job;
  readiness.facility.updatedAt = now;
  await saveLocalRegistration(cwd, registration);

  return {
    job,
    facility: readiness.facility,
  };
}

export async function listConstructionJobs(
  options: RuntimeOptions = {},
): Promise<ConstructionJobStatus[]> {
  const { registration } = await loadRequiredRegistration(options);

  return registration.modules
    .map((module) => ({
      facilityId: module.id,
      facilityName: module.displayName,
      job: module.runtimeAttributes.constructionJob,
    }))
    .filter((entry): entry is ConstructionJobStatus => isConstructionJob(entry.job));
}

export async function cancelConstructionJob(
  facilityId: string,
  options: RuntimeOptions = {},
): Promise<ConstructionCancelResult> {
  const { cwd, registration } = await loadRequiredRegistration(options);
  const facility = registration.modules.find((module) => module.id === facilityId);

  if (!facility) {
    throw new Error(`Construction facility not found: ${facilityId}`);
  }

  const job = facility.runtimeAttributes.constructionJob;

  if (!isConstructionJob(job)) {
    throw new Error(`No active construction job on ${facility.displayName}.`);
  }

  const result: ConstructionCancelResult = {
    facilityId: facility.id,
    facilityName: facility.displayName,
    jobId: job.id,
    blueprintId: job.blueprintId,
    outputModuleId: job.outputModuleId,
  };

  facility.runtimeAttributes.status = "idle";
  delete facility.runtimeAttributes.constructionJob;
  await saveLocalRegistration(cwd, registration);

  return result;
}

export async function addInventoryResource(
  resource: string,
  quantity: number,
  options: RuntimeOptions = {},
): Promise<InventoryAddResult> {
  if (!resource.trim()) {
    throw new Error("Resource name is required.");
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Inventory quantity must be a positive number.");
  }

  const { cwd, registration } = await loadRequiredRegistration(options);
  const storageModule = onlineStorageModules(registration.modules)[0];

  if (!storageModule) {
    throw new Error("No online supply cache or storage module found.");
  }

  const storedResources = parseStoredResources(storageModule);
  const currentQuantity = numericAttribute(storedResources[resource]);
  const nextQuantity = currentQuantity + quantity;

  storedResources[resource] = nextQuantity;
  await saveLocalRegistration(cwd, registration);

  return {
    resource,
    added: quantity,
    quantity: nextQuantity,
    storageModuleId: storageModule.id,
    storageModuleName: storageModule.displayName,
  };
}

export async function removeInventoryResource(
  resource: string,
  quantity: number,
  options: RuntimeOptions = {},
): Promise<InventoryRemoveResult> {
  if (!resource.trim()) {
    throw new Error("Resource name is required.");
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Inventory quantity must be a positive number.");
  }

  const { cwd, registration } = await loadRequiredRegistration(options);
  const storageModules = onlineStorageModules(registration.modules);
  const available = storageModules.reduce((total, module) => {
    const storedResources = parseStoredResources(module);
    return total + numericAttribute(storedResources[resource]);
  }, 0);

  if (available < quantity) {
    throw new Error(`Not enough ${resource} in local inventory.`);
  }

  let remaining = quantity;
  let storageModule: HabitatModule | undefined;

  for (const module of storageModules) {
    const storedResources = parseStoredResources(module);
    const currentQuantity = numericAttribute(storedResources[resource]);
    const removed = Math.min(currentQuantity, remaining);

    if (removed <= 0) {
      continue;
    }

    storageModule ??= module;
    storedResources[resource] = currentQuantity - removed;
    remaining -= removed;

    if (remaining <= 0) {
      break;
    }
  }

  await saveLocalRegistration(cwd, registration);

  return {
    resource,
    removed: quantity,
    quantity: aggregateInventory(registration.modules).find((entry) => entry.resource === resource)?.quantity ?? 0,
    storageModuleId: storageModule?.id ?? storageModules[0]?.id ?? "",
    storageModuleName: storageModule?.displayName ?? storageModules[0]?.displayName ?? "",
  };
}

export async function listInventory(options: RuntimeOptions = {}): Promise<InventoryEntry[]> {
  const { registration } = await loadRequiredRegistration(options);

  return aggregateInventory(registration.modules);
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
  const occupant = (registration.starterHumans ?? []).find((human) => human.locationModuleId === id);

  if (occupant) {
    throw new Error(`Cannot delete module ${id}: occupied by human ${occupant.id}.`);
  }

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

export async function getSolarIrradiance(options: RuntimeOptions = {}) {
  const cwd = await resolveProjectRoot(
    options.cwd ?? process.cwd(),
    options.projectRoot,
  );
  const config = await loadConfig(cwd);
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`${config.baseUrl}/world/solar-irradiance`, {
    method: "GET",
    headers: {},
  });

  await assertOk(response, "Solar irradiance request");
  const body = await parseJsonResponse(response);

  return {
    solarIrradiance: {
      wPerM2: numericAttribute(body?.solarIrradiance?.wPerM2),
      condition: String(body?.solarIrradiance?.condition ?? "unknown"),
    },
  } satisfies SolarIrradianceStatus;
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
