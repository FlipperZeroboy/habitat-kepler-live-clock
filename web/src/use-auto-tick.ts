import { useCallback, useEffect, useRef, useState } from "react";

export type AutoTickSchedulerOptions = {
  tick: () => Promise<boolean>;
  isManualAllowed: () => boolean;
  onError?: (error: unknown) => void;
  setIntervalImpl?: (callback: () => void, delay: number) => ReturnType<typeof setInterval>;
  clearIntervalImpl?: (handle: ReturnType<typeof setInterval>) => void;
};

type AutoTickScheduler = {
  running: () => boolean;
  start: () => void;
  stop: () => void;
};

const AUTO_TICK_INTERVAL_MS = 1000;

export function createAutoTickScheduler(options: AutoTickSchedulerOptions): AutoTickScheduler {
  const setIntervalImpl = options.setIntervalImpl ?? setInterval;
  const clearIntervalImpl = options.clearIntervalImpl ?? clearInterval;

  let intervalHandle: ReturnType<typeof setInterval> | null = null;
  let activeSessionToken: number | null = null;
  let nextSessionToken = 0;
  let inFlightSessionToken: number | null = null;

  function stopInternal(sessionToken = activeSessionToken) {
    if (sessionToken === null || activeSessionToken !== sessionToken) {
      return;
    }

    if (intervalHandle !== null) {
      clearIntervalImpl(intervalHandle);
      intervalHandle = null;
    }
    activeSessionToken = null;
  }

  async function runTick(sessionToken: number) {
    if (activeSessionToken !== sessionToken || inFlightSessionToken !== null) {
      return;
    }

    inFlightSessionToken = sessionToken;

    try {
      const advanced = await options.tick();
      if (activeSessionToken !== sessionToken) {
        return;
      }

      if (!advanced) {
        stopInternal(sessionToken);
        options.onError?.(new Error("Auto-tick stopped because the tick operation did not advance the Habitat clock."));
      }
    } catch (error) {
      if (activeSessionToken !== sessionToken) {
        return;
      }

      stopInternal(sessionToken);
      options.onError?.(error);
    } finally {
      if (inFlightSessionToken === sessionToken) {
        inFlightSessionToken = null;
      }
    }
  }

  return {
    running: () => activeSessionToken !== null,
    start: () => {
      if (activeSessionToken !== null || !options.isManualAllowed()) {
        return;
      }

      const sessionToken = ++nextSessionToken;
      activeSessionToken = sessionToken;
      intervalHandle = setIntervalImpl(() => {
        void runTick(sessionToken);
      }, AUTO_TICK_INTERVAL_MS);
      void runTick(sessionToken);
    },
    stop: () => {
      stopInternal();
    },
  };
}

export function useAutoTick({
  tick,
  manualTicksAllowed,
  onError,
}: {
  tick: () => Promise<boolean>;
  manualTicksAllowed: boolean;
  onError?: (error: unknown) => void;
}) {
  const [running, setRunning] = useState(false);
  const tickRef = useRef(tick);
  const manualAllowedRef = useRef(manualTicksAllowed);
  const onErrorRef = useRef(onError);
  const schedulerRef = useRef<AutoTickScheduler | null>(null);

  tickRef.current = tick;
  manualAllowedRef.current = manualTicksAllowed;
  onErrorRef.current = onError;

  if (schedulerRef.current === null) {
    schedulerRef.current = createAutoTickScheduler({
      tick: () => tickRef.current(),
      isManualAllowed: () => manualAllowedRef.current,
      onError: (error) => {
        setRunning(false);
        onErrorRef.current?.(error);
      },
    });
  }

  const start = useCallback(() => {
    schedulerRef.current?.start();
    setRunning(schedulerRef.current?.running() ?? false);
  }, []);

  const stop = useCallback(() => {
    schedulerRef.current?.stop();
    setRunning(false);
  }, []);

  useEffect(() => stop, [stop]);

  return { running, start, stop };
}
