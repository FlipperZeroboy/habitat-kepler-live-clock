import { expect, test } from "bun:test";
import { createKeplerStream } from "../src/kepler-stream";

function fakeSocket() {
  return {
    onopen: null as (() => void) | null,
    onmessage: null as ((event: { data: string }) => void) | null,
    onerror: null as (() => void) | null,
    onclose: null as (() => void) | null,
    sent: [] as string[],
    send(data: string) { this.sent.push(data); },
    close() {},
  };
}

test("Kepler stream authenticates with the habitat token and applies advancedBy notices", async () => {
  const socket = fakeSocket();
  const messages: unknown[] = [];
  const stream = createKeplerStream({
    streamUrl: "wss://planet.turingguild.com/planet/stream",
    apiToken: "habitat-token",
    habitatId: "habitat-1",
    subscriptions: ["ticks"],
    createSocket: () => socket,
    onMessage: (message) => messages.push(message),
  });

  stream.start();
  socket.onopen?.();
  socket.onmessage?.({ data: JSON.stringify({ type: "hello_ack", connectionId: "connection-1", habitatId: "habitat-1", subscriptions: ["ticks"], currentTick: 800, catchUpTicks: 0, tickIntervalMs: 1000, ticksPerPulse: 1, clockStatus: "running", serverTime: "2026-07-16T12:00:00.000Z" }) });
  socket.onmessage?.({ data: JSON.stringify({
    type: "planet_tick", tick: 810, previousTick: 800, advancedBy: 10,
    secondsPerTick: 5, issuedAt: "2026-07-16T12:00:00.000Z",
  }) });

  expect(JSON.parse(socket.sent[0])).toEqual({
    type: "hello",
    apiToken: "habitat-token",
    subscribe: ["ticks"],
  });
  expect(messages).toEqual([expect.objectContaining({ tick: 810, advancedBy: 10 })]);
  stream.stop();
});

test("Kepler stream reconnects without requesting catch-up state", () => {
  const sockets = [fakeSocket(), fakeSocket()];
  let index = 0;
  let reconnectCallback: (() => void) | null = null;
  const stream = createKeplerStream({
    streamUrl: "wss://planet.turingguild.com/planet/stream",
    apiToken: "habitat-token",
    habitatId: "habitat-1",
    subscriptions: ["ticks"],
    createSocket: () => sockets[index++],
    setTimeoutImpl: ((callback: () => void) => { reconnectCallback = callback; return 1 as unknown as ReturnType<typeof setTimeout>; }) as typeof setTimeout,
    clearTimeoutImpl: (() => {}) as typeof clearTimeout,
    onMessage: () => {},
  });

  stream.start();
  sockets[0].onopen?.();
  sockets[0].onmessage?.({ data: JSON.stringify({ type: "hello_ack", connectionId: "connection-1", habitatId: "habitat-1", subscriptions: ["ticks"], currentTick: 800, catchUpTicks: 0, tickIntervalMs: 1000, ticksPerPulse: 1, clockStatus: "running", serverTime: "2026-07-16T12:00:00.000Z" }) });
  sockets[0].onclose?.();
  reconnectCallback?.();
  sockets[1].onopen?.();
  sockets[1].onmessage?.({ data: JSON.stringify({ type: "hello_ack", connectionId: "connection-2", habitatId: "habitat-1", subscriptions: ["ticks"], currentTick: 800, catchUpTicks: 0, tickIntervalMs: 1000, ticksPerPulse: 1, clockStatus: "running", serverTime: "2026-07-16T12:00:00.000Z" }) });

  expect(JSON.parse(sockets[1].sent[0])).toEqual({
    type: "hello",
    apiToken: "habitat-token",
    subscribe: ["ticks"],
  });
  expect(sockets[1].sent[0]).not.toContain("lastAppliedPlanetTick");
  stream.stop();
});

test("Kepler stream accepts ticks only after validating hello_ack and filters duplicate absolute ticks", async () => {
  const socket = fakeSocket();
  const messages: number[] = [];
  const stream = createKeplerStream({
    streamUrl: "wss://planet.turingguild.com/planet/stream",
    apiToken: "habitat-token",
    habitatId: "habitat-1",
    subscriptions: ["ticks"],
    lastAppliedTick: 800,
    createSocket: () => socket,
    onMessage: (message) => { messages.push(message.tick); return true; },
    onError: () => {},
  });

  stream.start();
  socket.onopen?.();
  socket.onmessage?.({ data: JSON.stringify({ type: "planet_tick", tick: 900, previousTick: 800, advancedBy: 100, secondsPerTick: 5, issuedAt: "2026-07-15T14:30:00.000Z" }) });
  expect(messages).toEqual([]);

  socket.onmessage?.({ data: JSON.stringify({ type: "hello_ack", connectionId: "connection-1", habitatId: "habitat-1", subscriptions: ["ticks"], currentTick: 900, catchUpTicks: 0, tickIntervalMs: 1000, ticksPerPulse: 1, clockStatus: "running", serverTime: "2026-07-15T14:30:00.000Z" }) });
  socket.onmessage?.({ data: JSON.stringify({ type: "planet_tick", tick: 900, previousTick: 800, advancedBy: 100, secondsPerTick: 5, issuedAt: "2026-07-15T14:30:00.000Z" }) });
  socket.onmessage?.({ data: JSON.stringify({ type: "planet_tick", tick: 899, previousTick: 898, advancedBy: 1, secondsPerTick: 5, issuedAt: "2026-07-15T14:29:00.000Z" }) });
  socket.onmessage?.({ data: JSON.stringify({ type: "planet_tick", tick: 910, previousTick: 900, advancedBy: 10, secondsPerTick: 5, issuedAt: "2026-07-15T14:31:00.000Z" }) });

  expect(messages).toEqual([900, 910]);
  stream.stop();
});

test("Kepler stream rejects a hello_ack for a different habitat", () => {
  const socket = fakeSocket();
  const errors: string[] = [];
  const stream = createKeplerStream({
    streamUrl: "wss://planet.turingguild.com/planet/stream",
    apiToken: "habitat-token",
    habitatId: "habitat-1",
    subscriptions: ["ticks"],
    createSocket: () => socket,
    onMessage: () => {},
    onError: (message) => { errors.push(message); },
  });

  stream.start();
  socket.onopen?.();
  socket.onmessage?.({ data: JSON.stringify({ type: "hello_ack", connectionId: "connection-1", habitatId: "other-habitat", subscriptions: ["ticks"], currentTick: 900, catchUpTicks: 0, tickIntervalMs: 1000, ticksPerPulse: 1, clockStatus: "running", serverTime: "2026-07-15T14:30:00.000Z" }) });
  socket.onmessage?.({ data: JSON.stringify({ type: "planet_tick", tick: 901, previousTick: 900, advancedBy: 1, secondsPerTick: 5, issuedAt: "2026-07-15T14:31:00.000Z" }) });

  expect(errors).toContain("Kepler hello_ack habitatId did not match the registered Habitat.");
  stream.stop();
});
