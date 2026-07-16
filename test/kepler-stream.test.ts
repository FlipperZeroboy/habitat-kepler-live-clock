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
    createSocket: () => socket,
    onMessage: (message) => messages.push(message),
  });

  stream.start();
  socket.onopen?.();
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
    createSocket: () => sockets[index++],
    setTimeoutImpl: ((callback: () => void) => { reconnectCallback = callback; return 1 as unknown as ReturnType<typeof setTimeout>; }) as typeof setTimeout,
    clearTimeoutImpl: (() => {}) as typeof clearTimeout,
    onMessage: () => {},
  });

  stream.start();
  sockets[0].onopen?.();
  sockets[0].onclose?.();
  reconnectCallback?.();
  sockets[1].onopen?.();

  expect(JSON.parse(sockets[1].sent[0])).toEqual({
    type: "hello",
    apiToken: "habitat-token",
    subscribe: ["ticks"],
  });
  expect(sockets[1].sent[0]).not.toContain("lastAppliedPlanetTick");
  stream.stop();
});
