import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type FetchLike = typeof fetch;

type JsonObject = Record<string, unknown>;

export type StarterModule = {
  id: string;
  blueprintId: string;
  displayName: string;
  connectedTo: string[];
  runtimeAttributes: JsonObject;
  capabilities: string[];
};

export type ProductionBlueprint = {
  blueprintId: string;
  displayName: string;
  output?: JsonObject;
  runtimeAttributes?: JsonObject;
  capabilities?: string[];
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

export type LocalRegistration = {
  habitatUuid: string;
  habitatId: string;
  displayName: string;
  registeredAt: string;
  starterModules: StarterModule[];
  blueprints: ProductionBlueprint[];
  modules: HabitatModule[];
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
    return normalizeRegistration(JSON.parse(contents) as Partial<LocalRegistration>);
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

function normalizeRegistration(registration: Partial<LocalRegistration>): LocalRegistration {
  return {
    habitatUuid: registration.habitatUuid ?? "",
    habitatId: registration.habitatId ?? "",
    displayName: registration.displayName ?? "",
    registeredAt: registration.registeredAt ?? "",
    starterModules: Array.isArray(registration.starterModules) ? registration.starterModules : [],
    blueprints: Array.isArray(registration.blueprints) ? registration.blueprints : [],
    modules: Array.isArray(registration.modules) ? registration.modules : [],
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
}

async function deleteLocalRegistration(cwd: string) {
  await rm(getRegistrationFilePath(cwd), { force: true });
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
    starterModules,
    blueprints: Array.isArray(body.blueprints) ? body.blueprints : [],
    modules: hydrateStarterModules(body.habitatId, starterModules, registeredAt),
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

export async function getLocalStatusSummary(options: RuntimeOptions = {}) {
  const modules = await listModules(options);

  return {
    moduleCount: modules.length,
  };
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
