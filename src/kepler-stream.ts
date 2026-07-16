export type PlanetTickMessage = {
  type: "planet_tick";
  tick: number;
  previousTick: number;
  advancedBy: number;
  secondsPerTick: number;
  issuedAt: string;
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
  createSocket?: (url: string) => SocketLike;
  onConnected?: () => void | Promise<void>;
  onMessage: (message: PlanetTickMessage) => void | Promise<void>;
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
    typeof message.secondsPerTick === "number" &&
    typeof message.issuedAt === "string";
}

export function createKeplerStream(options: KeplerStreamOptions): KeplerStream {
  const createSocket = options.createSocket ?? ((url) => new WebSocket(url) as unknown as SocketLike);
  const setTimeoutImpl = options.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = options.clearTimeoutImpl ?? clearTimeout;
  const reconnectDelayMs = options.reconnectDelayMs ?? 1000;
  let socket: SocketLike | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let running = false;

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
        socket?.send(JSON.stringify({ type: "hello", apiToken: options.apiToken, subscribe: ["ticks"] }));
        void options.onConnected?.();
      };
      socket.onmessage = (event) => {
        try {
          const parsed: unknown = JSON.parse(event.data);
          if (isPlanetTickMessage(parsed)) {
            void options.onMessage(parsed);
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
      currentSocket?.close();
    },
  };
}
