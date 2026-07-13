import { expect, test } from "bun:test";
import { createApiClient, HabitatApiError } from "../src/api-client";

test("API client defaults to the local Habitat backend and parses JSON", async () => {
  let requestedUrl = "";
  let requestedHeaders: HeadersInit | undefined;
  const client = createApiClient({
    fetchImpl: async (input, init) => {
      requestedUrl = String(input);
      requestedHeaders = init?.headers;
      return new Response(JSON.stringify({ registration: null }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  await expect(client.get("/registration")).resolves.toEqual({ registration: null });
  expect(requestedUrl).toBe("http://localhost:8787/registration");
  expect(requestedHeaders).toEqual({ Accept: "application/json" });
});

test("API client sends JSON bodies and honors the base URL override", async () => {
  let requestedUrl = "";
  let requestedInit: RequestInit | undefined;
  const client = createApiClient({
    baseUrl: "http://example.test/api/",
    fetchImpl: async (input, init) => {
      requestedUrl = String(input);
      requestedInit = init;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  await expect(client.put("/inventory", { ferrite: 3 })).resolves.toEqual({ ok: true });
  expect(requestedUrl).toBe("http://example.test/api/inventory");
  expect(requestedInit?.method).toBe("PUT");
  expect(requestedInit?.headers).toEqual({
    Accept: "application/json",
    "Content-Type": "application/json",
  });
  expect(requestedInit?.body).toBe(JSON.stringify({ ferrite: 3 }));
});

test("API client turns a backend error response into a friendly error", async () => {
  const client = createApiClient({
    fetchImpl: async () => new Response(JSON.stringify({ error: { message: "Registration required." } }), {
      status: 409,
      headers: { "content-type": "application/json" },
    }),
  });

  await expect(client.get("/registration")).rejects.toMatchObject({
    name: "HabitatApiError",
    message: "Registration required.",
    status: 409,
  });
});

test("API client turns connection failures into a friendly CLI error", async () => {
  const client = createApiClient({
    baseUrl: "http://localhost:18787",
    fetchImpl: async () => {
      throw new Error("connection refused");
    },
  });

  await expect(client.get("/registration")).rejects.toEqual(
    new HabitatApiError(
      "Could not reach the Habitat backend at http://localhost:18787. Start it with `bun run server`.",
    ),
  );
});

test("API client sends JSON delete requests", async () => {
  let requestedInit: RequestInit | undefined;
  const client = createApiClient({
    fetchImpl: async (_input, init) => {
      requestedInit = init;
      return new Response(JSON.stringify({ registration: null, habitatId: "habitat-1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  await expect(client.delete("/registration")).resolves.toEqual({ registration: null, habitatId: "habitat-1" });
  expect(requestedInit?.method).toBe("DELETE");
  expect(requestedInit?.headers).toEqual({ Accept: "application/json" });
});
