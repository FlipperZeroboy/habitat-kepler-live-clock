import { useCallback, useState } from "react";
import { habitatApi, type HabitatApi } from "./api";
import type { DashboardData, Registration } from "./types";

type DashboardState = {
  data: DashboardData | null;
  registered: boolean | null;
  loading: boolean;
  mutating: string | null;
  error: string | null;
};

type DashboardMutationResult =
  | { ok: true }
  | { ok: false; errorMessage: string };

function messageFor(error: unknown) {
  return error instanceof Error ? error.message : "Habitat backend request failed.";
}

export async function runDashboardMutation({
  operation,
  refresh,
  refreshOnError = false,
}: {
  operation: () => Promise<unknown>;
  refresh: () => Promise<void>;
  refreshOnError?: boolean;
}): Promise<DashboardMutationResult> {
  try {
    await operation();
    await refresh();
    return { ok: true };
  } catch (error) {
    const errorMessage = messageFor(error);

    if (refreshOnError) {
      try {
        await refresh();
      } catch {
        // Keep the original mutation failure for callers and existing UI flows.
      }
    }

    return { ok: false, errorMessage };
  }
}

export function useDashboard(api: HabitatApi = habitatApi) {
  const [state, setState] = useState<DashboardState>({ data: null, registered: null, loading: true, mutating: null, error: null });

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const registrationResponse = await api.registration();
      if (!registrationResponse.registration) {
        setState({ data: null, registered: false, loading: false, mutating: null, error: null });
        return;
      }
      const [status, power, clockStatus] = await Promise.all([api.status(), api.powerOverview(), api.clockStatus()]);
      setState({
        data: { registration: registrationResponse.registration, status: status.status, power, clock: clockStatus.clock },
        registered: true,
        loading: false,
        mutating: null,
        error: null,
      });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: messageFor(error) }));
    }
  }, [api]);

  const mutate = useCallback(async (
    label: string,
    operation: () => Promise<unknown>,
    options?: { refreshOnError?: boolean },
  ) => {
    setState((current) => ({ ...current, mutating: label, error: null }));
    const result = await runDashboardMutation({
      operation,
      refresh,
      refreshOnError: options?.refreshOnError ?? false,
    });

    if (!result.ok) {
      setState((current) => ({ ...current, mutating: null, error: result.errorMessage }));
      return false;
    }

    return true;
  }, [refresh]);

  const register = useCallback((displayName: string) => mutate("register", () => api.register(displayName)), [api, mutate]);
  const unregister = useCallback(() => mutate("unregister", () => api.unregister()), [api, mutate]);
  const setModuleStatus = useCallback((moduleId: string, status: "offline" | "online") => mutate(`module:${moduleId}`, () => api.updateModule(moduleId, status)), [api, mutate]);
  const advanceTicks = useCallback(
    (count: number) => mutate(`tick:${count}`, () => api.tick(count), { refreshOnError: true }),
    [api, mutate],
  );

  return { ...state, refresh, register, unregister, setModuleStatus, advanceTicks };
}

export type DashboardController = ReturnType<typeof useDashboard>;
export type DashboardRegistration = Registration;
