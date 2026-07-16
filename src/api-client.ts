type FetchLike = typeof fetch;
import type {
  HabitatModule,
  InventoryAddResult,
  InventoryEntry,
  InventoryRemoveResult,
  ConstructionCancelResult,
  ConstructionDryRun,
  ConstructionJobStatus,
  ConstructionStart,
  TickSummary,
  StarterHuman,
  EvaState,
  CollectionResult,
  HabitatAlert,
  ClockState,
  StreamMetadata,
} from "./habitat";

export type ApiRegistration = {
  habitatUuid: string;
  habitatId: string;
  displayName: string;
  apiToken: string;
};

export type RegistrationResponse = {
  registration: ApiRegistration | null;
  habitatId?: string;
};

export type StatusResponse = {
  status: {
    habitat: {
      id: string;
      habitatSlug: string;
      displayName: string;
      catalogVersion: string;
      status: string;
      lastSeenAt?: string | null;
    };
    currentTick: number;
    moduleCount: number;
    powerSummary: {
      totalPowerDrawKw: number;
      energyUsedKwh: number;
      batteryEnergyKwh: number;
      batteryCapacityKwh: number;
      powerShortageKwh: number;
    };
    streamUrl: string | null;
    apiToken: string | null;
    stream?: StreamMetadata | null;
    clock?: ClockState;
  };
};
export type ClockStatusResponse = {
  clock: ClockState & { listening: boolean; manualTicksAllowed: boolean };
};

export type ModulesResponse = { modules: HabitatModule[] };
export type HumansResponse = { humans: StarterHuman[] };
export type HumanResponse = { human: StarterHuman };
export type EvaResponse = { eva: EvaState };
export type CollectionResponse = CollectionResult;
export type AlertsResponse = { alerts: HabitatAlert[] };
export type AlertResponse = { alert: HabitatAlert };
export type ModuleResponse = { module: HabitatModule };
export type ModuleDeleteResponse = { moduleId: string };
export type InventoryResponse = { inventory: InventoryEntry[] };
export type InventoryMutationResponse = {
  inventory: InventoryAddResult | InventoryRemoveResult;
};
export type InventoryAddResponse = { inventory: InventoryAddResult };
export type InventoryRemoveResponse = { inventory: InventoryRemoveResult };
export type PowerOverviewResponse = {
  modules: HabitatModule[];
  power: {
    generationKw: number;
    consumptionKw: number;
    netPowerKw: number;
    batteryEnergyKwh: number;
    batteryCapacityKwh: number;
    powerShortageKwh: number;
  };
  solarIrradiance: {
    wPerM2: number;
    condition: string;
  };
};
export type TickResponse = { tick: TickSummary };
export type ConstructionDryRunResponse = { construction: ConstructionDryRun };
export type ConstructionStartResponse = { construction: ConstructionStart };
export type ConstructionJobsResponse = { jobs: ConstructionJobStatus[] };
export type ConstructionCancelResponse = { construction: ConstructionCancelResult };

export type ApiClientOptions = {
  baseUrl?: string;
  fetchImpl?: FetchLike;
};

export class HabitatApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "HabitatApiError";
    this.status = status;
  }
}

function getErrorMessage(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return undefined;
  }

  const response = body as Record<string, unknown>;
  const error = response.error;

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object" && !Array.isArray(error)) {
    const message = (error as Record<string, unknown>).message;

    if (typeof message === "string") {
      return message;
    }
  }

  return typeof response.message === "string" ? response.message : undefined;
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

export class HabitatApiClient {
  readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = normalizeBaseUrl(
      options.baseUrl ?? process.env.HABITAT_API_BASE_URL ?? "http://localhost:8787",
    );
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  get<T>(path: string) {
    return this.request<T>(path, { method: "GET" });
  }

  post<T>(path: string, body: unknown) {
    return this.request<T>(path, { method: "POST", body: JSON.stringify(body) });
  }

  put<T>(path: string, body: unknown) {
    return this.request<T>(path, { method: "PUT", body: JSON.stringify(body) });
  }

  delete<T>(path: string) {
    return this.request<T>(path, { method: "DELETE" });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const hasBody = init.body !== undefined;

    try {
      const response = await this.fetchImpl(url, {
        ...init,
        headers: {
          Accept: "application/json",
          ...(hasBody ? { "Content-Type": "application/json" } : {}),
        },
      });
      const text = await response.text();
      let body: unknown;

      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          throw new HabitatApiError("Habitat backend returned invalid JSON.", response.status);
        }
      }

      if (!response.ok) {
        throw new HabitatApiError(
          getErrorMessage(body) ?? `Habitat backend request failed with HTTP ${response.status}.`,
          response.status,
        );
      }

      return body as T;
    } catch (error) {
      if (error instanceof HabitatApiError) {
        throw error;
      }

      throw new HabitatApiError(
        `Could not reach the Habitat backend at ${this.baseUrl}. Start it with \`bun run server\`.`,
      );
    }
  }
}

export function createApiClient(options: ApiClientOptions = {}) {
  return new HabitatApiClient(options);
}
