import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

type FetchLike = typeof fetch;

export type LocalRegistration = {
  habitatUuid: string;
  habitatId: string;
  displayName: string;
  registeredAt: string;
  starterModules: unknown[];
  blueprints: unknown[];
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

type RuntimeOptions = {
  cwd?: string;
  fetchImpl?: FetchLike;
};

type RegisterOptions = RuntimeOptions & {
  randomUuid?: () => string;
  now?: () => Date;
};

type KeplerConfig = {
  baseUrl: string;
  token: string;
};

export function getHabitatDirectory(cwd = process.cwd()) {
  return join(cwd, ".habitat");
}

export function getRegistrationFilePath(cwd = process.cwd()) {
  return join(getHabitatDirectory(cwd), "registration.json");
}

async function ensureHabitatDirectory(cwd: string) {
  await mkdir(getHabitatDirectory(cwd), { recursive: true });
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
  let fileValues = new Map<string, string>();

  try {
    fileValues = parseEnv(await readFile(envPath, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

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

export async function loadLocalRegistration(cwd = process.cwd()) {
  try {
    const contents = await readFile(getRegistrationFilePath(cwd), "utf8");
    return JSON.parse(contents) as LocalRegistration;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
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
  const cwd = options.cwd ?? process.cwd();
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

  const registration: LocalRegistration = {
    habitatUuid,
    habitatId: body.habitatId,
    displayName: name,
    registeredAt: (options.now ?? (() => new Date()))().toISOString(),
    starterModules: body.starterModules,
    blueprints: body.blueprints,
  };

  await saveLocalRegistration(cwd, registration);
  return registration;
}

export async function getRegistrationStatus(options: RuntimeOptions = {}) {
  const cwd = options.cwd ?? process.cwd();
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
  const cwd = options.cwd ?? process.cwd();
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
