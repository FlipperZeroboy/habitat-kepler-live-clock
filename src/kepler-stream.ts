export type PlanetTickMessage = {
  type: "planet_tick";
  tick: number;
  previousTick: number;
  advancedBy: number;
  secondsPerTick?: number;
  issuedAt: string;
};

type PlanetStreamHelloAck = {
  type: "hello_ack";
  connectionId: string;
  habitatId: string;
  subscriptions: string[];
  currentTick: number;
  catchUpTicks: number;
  tickIntervalMs: number;
  ticksPerPulse: number;
  clockStatus: "paused" | "running";
  serverTime: string;
};

type SocketLike = {
  onopen: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onerror: (() => void) | null;
  onclose: (() => void) | null;
  send(data: string): void;
  close(): void;
};

export type KeplerStreamOptions = {
  streamUrl: string;
  apiToken: string;
  habitatId: string;
  subscriptions: string[];
  lastAppliedTick?: number | null;
  createSocket?: (url: string) => SocketLike;
  onConnected?: () => void | Promise<void>;
  onMessage: (message: PlanetTickMessage) => boolean | void | Promise<boolean | void>;
  onError?: (message: string) => void | Promise<void>;
  reconnectDelayMs?: number;
  setTimeoutImpl?: typeof setTimeout;
  clearTimeoutImpl?: typeof clearTimeout;
};

export type KeplerStream = {
  start(): void;
  stop(): void;
};

function isPlanetTickMessage(value: unknown): value is PlanetTickMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  return message.type === "planet_tick" &&
    Number.isInteger(message.tick) &&
    Number.isInteger(message.previousTick) &&
    Number.isInteger(message.advancedBy) &&
    Number(message.advancedBy) > 0 &&
    typeof message.issuedAt === "string";
}

function isHelloAck(value: unknown): value is PlanetStreamHelloAck {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  return message.type === "hello_ack" &&
    typeof message.connectionId === "string" &&
    typeof message.habitatId === "string" &&
    Array.isArray(message.subscriptions) &&
    message.subscriptions.every((subscription) => typeof subscription === "string") &&
    Number.isInteger(message.currentTick) &&
    Number.isInteger(message.catchUpTicks) &&
    Number.isInteger(message.tickIntervalMs) &&
    Number.isInteger(message.ticksPerPulse) &&
    (message.clockStatus === "paused" || message.clockStatus === "running") &&
    typeof message.serverTime === "string";
}

export function createKeplerStream(options: KeplerStreamOptions): KeplerStream {
  const createSocket = options.createSocket ?? ((url) => new WebSocket(url) as unknown as SocketLike);
  const setTimeoutImpl = options.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = options.clearTimeoutImpl ?? clearTimeout;
  const reconnectDelayMs = options.reconnectDelayMs ?? 1000;
  let socket: SocketLike | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let acknowledged = false;
  let lastAppliedTick = options.lastAppliedTick ?? null;

  const reportError = (message: string) => {
    void options.onError?.(message);
  };

  const scheduleReconnect = () => {
    if (!running || reconnectTimer) return;
    reconnectTimer = setTimeoutImpl(() => {
      reconnectTimer = null;
      connect();
    }, reconnectDelayMs);
  };

  const connect = () => {
    if (!running) return;
    try {
      socket = createSocket(options.streamUrl);
      socket.onopen = () => {
        acknowledged = false;
        socket?.send(JSON.stringify({ type: "hello", apiToken: options.apiToken, subscribe: options.subscriptions }));
      };
      socket.onmessage = (event) => {
        try {
          const parsed: unknown = JSON.parse(event.data);
          if (!acknowledged) {
            if (!isHelloAck(parsed)) {
              reportError("Kepler stream did not send a valid hello_ack.");
              socket?.close();
              return;
            }
            if (parsed.habitatId !== options.habitatId) {
              reportError("Kepler hello_ack habitatId did not match the registered Habitat.");
              socket?.close();
              return;
            }
            if (options.subscriptions.some((subscription) => !parsed.subscriptions.includes(subscription))) {
              reportError("Kepler hello_ack did not confirm the requested stream subscriptions.");
              socket?.close();
              return;
            }
            acknowledged = true;
            void options.onConnected?.();
            return;
          }
          if (isPlanetTickMessage(parsed)) {
            if (lastAppliedTick !== null && parsed.tick <= lastAppliedTick) return;
            const previousTick = lastAppliedTick;
            lastAppliedTick = parsed.tick;
            void Promise.resolve(options.onMessage(parsed)).then((applied) => {
              if (applied === false) lastAppliedTick = previousTick;
            }).catch((error) => {
              lastAppliedTick = previousTick;
              reportError(error instanceof Error ? error.message : "Kepler tick application failed.");
            });
          }
        } catch {
          reportError("Kepler stream sent invalid JSON.");
        }
      };
      socket.onerror = () => {
        reportError("Kepler WebSocket connection error.");
      };
      socket.onclose = () => {
        socket = null;
        acknowledged = false;
        if (running) {
          reportError("Kepler WebSocket disconnected unexpectedly.");
          scheduleReconnect();
        }
      };
    } catch {
      reportError("Could not open the Kepler WebSocket.");
      scheduleReconnect();
    }
  };

  return {
    start() {
      if (running) return;
      running = true;
      connect();
    },
    stop() {
      running = false;
      if (reconnectTimer) {
        clearTimeoutImpl(reconnectTimer);
        reconnectTimer = null;
      }
      const currentSocket = socket;
      socket = null;
      acknowledged = false;
      currentSocket?.close();
    },
  };
}
