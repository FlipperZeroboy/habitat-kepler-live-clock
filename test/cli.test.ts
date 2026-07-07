import { expect, test } from "bun:test";

test("help advertises only Kepler registration commands from the Habitat command set", async () => {
  const proc = Bun.spawn(["bun", "run", "src/index.ts", "--help"], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  const output = await new Response(proc.stdout).text();
  const errorOutput = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  expect(exitCode).toBe(0);
  expect(errorOutput).toBe("");
  expect(output).toContain("register");
  expect(output).toContain("status");
  expect(output).toContain("unregister");
  expect(output).not.toContain("zone");
  expect(output).not.toContain("door");
  expect(output).not.toContain("airlock");
  expect(output).not.toContain("sensor");
  expect(output).not.toContain("rover");
  expect(output).not.toContain("greenhouse");
});
