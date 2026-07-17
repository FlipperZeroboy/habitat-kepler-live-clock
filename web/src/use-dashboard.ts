import { useCallback, useRef, useState } from "react";
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

export function applyDashboardRefreshSuccess(
  current: DashboardState,
  next: Pick<DashboardState, "data" | "registered">,
): DashboardState {
  return {
    ...current,
    ...next,
    loading: false,
    error: null,
  };
}

export function clearCompletedDashboardMutation(
  current: DashboardState,
  label: string,
): DashboardState {
  if (current.mutating !== label) {
    return current;
  }

  return { ...current, mutating: null };
}

export function createSharedTickOperationGuard<Args extends unknown[], Result>(
  operation: (...args: Args) => Promise<Result>,
) {
  let inFlight: Promise<Result> | null = null;

  return (...args: Args) => {
    if (inFlight) {
      return inFlight;
    }

    const guardedPromise = operation(...args).finally(() => {
      if (inFlight === guardedPromise) {
        inFlight = null;
      }
    });
    inFlight = guardedPromise;
    return guardedPromise;
  };
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
  let operationCompleted = false;

  try {
    await operation();
    operationCompleted = true;
    await refresh();
    return { ok: true };
  } catch (error) {
    const errorMessage = messageFor(error);

    if (refreshOnError && !operationCompleted) {
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
  const runTickMutationRef = useRef<(count: number) => Promise<boolean>>(() => Promise.resolve(false));
  const tickOperationGuardRef = useRef<((count: number) => Promise<boolean>) | null>(null);

  const loadDashboardState = useCallback(async (options?: { throwOnError?: boolean }) => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const registrationResponse = await api.registration();
      if (!registrationResponse.registration) {
        setState((current) => applyDashboardRefreshSuccess(current, { data: null, registered: false }));
        return;
      }
      const [status, power, clockStatus] = await Promise.all([api.status(), api.powerOverview(), api.clockStatus()]);
      setState((current) => applyDashboardRefreshSuccess(current, {
        data: { registration: registrationResponse.registration, status: status.status, power, clock: clockStatus.clock },
        registered: true,
      }));
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: messageFor(error) }));
      if (options?.throwOnError) {
        throw error;
      }
    }
  }, [api]);

  const refresh = useCallback(() => loadDashboardState(), [loadDashboardState]);
  const refreshForMutation = useCallback(
    () => loadDashboardState({ throwOnError: true }),
    [loadDashboardState],
  );

  const mutate = useCallback(async (
    label: string,
    operation: () => Promise<unknown>,
    options?: { refreshOnError?: boolean; refresh?: () => Promise<void> },
  ) => {
    setState((current) => ({ ...current, mutating: label, error: null }));
    const result = await runDashboardMutation({
      operation,
      refresh: options?.refresh ?? refresh,
      refreshOnError: options?.refreshOnError ?? false,
    });

    if (!result.ok) {
      setState((current) => ({ ...current, mutating: null, error: result.errorMessage }));
      return false;
    }

    setState((current) => clearCompletedDashboardMutation(current, label));
    return true;
  }, [refresh]);

  const register = useCallback((displayName: string) => mutate("register", () => api.register(displayName)), [api, mutate]);
  const unregister = useCallback(() => mutate("unregister", () => api.unregister()), [api, mutate]);
  const setModuleStatus = useCallback((moduleId: string, status: "offline" | "online") => mutate(`module:${moduleId}`, () => api.updateModule(moduleId, status)), [api, mutate]);

  runTickMutationRef.current = (count: number) => (
    mutate(`tick:${count}`, () => api.tick(count), {
      refreshOnError: true,
      refresh: refreshForMutation,
    })
  );

  if (tickOperationGuardRef.current === null) {
    tickOperationGuardRef.current = createSharedTickOperationGuard((count: number) => runTickMutationRef.current(count));
  }

  const advanceTicks = useCallback(
    (count: number) => tickOperationGuardRef.current?.(count) ?? Promise.resolve(false),
    [],
  );

  return { ...state, refresh, register, unregister, setModuleStatus, advanceTicks };
}

export type DashboardController = ReturnType<typeof useDashboard>;
export type DashboardRegistration = Registration;
