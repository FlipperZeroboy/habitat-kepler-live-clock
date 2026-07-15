import type {
  HabitatModule,
  PowerOverviewResponse,
  RegistrationResponse,
  StatusResponse,
  TickResponse,
} from "./types";

const apiPrefix = import.meta.env.DEV ? "/api" : "";

export class WebApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "WebApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(`${apiPrefix}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
    const body = await response.json().catch(() => undefined);
    if (!response.ok) {
      const error = body as { error?: { message?: string } } | undefined;
      throw new WebApiError(error?.error?.message ?? `Backend request failed with HTTP ${response.status}.`, response.status);
    }
    return body as T;
  } catch (error) {
    if (error instanceof WebApiError) throw error;
    throw new WebApiError("Could not reach the Habitat backend. Start it with `bun run server`.");
  }
}

export const habitatApi = {
  registration: () => request<RegistrationResponse>("/registration"),
  register: (displayName: string) => request<RegistrationResponse>("/registration", { method: "POST", body: JSON.stringify({ displayName }) }),
  unregister: () => request<RegistrationResponse>("/registration", { method: "DELETE" }),
  status: () => request<StatusResponse>("/status"),
  modules: () => request<{ modules: HabitatModule[] }>("/modules"),
  powerOverview: () => request<PowerOverviewResponse>("/power/overview"),
  updateModule: (id: string, status: "offline" | "online") => request<{ module: HabitatModule }>(`/modules/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ status }) }),
  tick: (count: number) => request<TickResponse>("/ticks", { method: "POST", body: JSON.stringify({ count }) }),
};

export type HabitatApi = typeof habitatApi;
