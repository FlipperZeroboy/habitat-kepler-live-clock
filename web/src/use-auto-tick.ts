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
  let running = false;
  let inFlight = false;

  function stopInternal() {
    if (intervalHandle !== null) {
      clearIntervalImpl(intervalHandle);
      intervalHandle = null;
    }
    running = false;
  }

  async function runTick() {
    if (!running || inFlight) {
      return;
    }

    inFlight = true;

    try {
      const advanced = await options.tick();
      if (!advanced) {
        stopInternal();
        options.onError?.(new Error("Auto-tick stopped because the tick operation did not advance the Habitat clock."));
      }
    } catch (error) {
      stopInternal();
      options.onError?.(error);
    } finally {
      inFlight = false;
    }
  }

  return {
    running: () => running,
    start: () => {
      if (running || !options.isManualAllowed()) {
        return;
      }

      running = true;
      intervalHandle = setIntervalImpl(() => {
        void runTick();
      }, AUTO_TICK_INTERVAL_MS);
      void runTick();
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
