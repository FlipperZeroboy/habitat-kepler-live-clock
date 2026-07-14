export function printError(error: unknown) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

export function parseHealth(value: string) {
  const health = Number(value);

  if (Number.isNaN(health)) {
    throw new Error("health must be a number");
  }

  return health;
}

export function parseTickCount(value: string) {
  const count = Number(value);

  if (!Number.isInteger(count) || count <= 0) {
    throw new Error("tick count must be a positive integer");
  }

  return count;
}

export function parseScanCoordinate(value: string) {
  const coordinate = Number(value);
  if (!Number.isInteger(coordinate)) {
    throw new Error("scan coordinates must be integers");
  }
  return coordinate;
}

export function parseSensorStrength(value: string) {
  const strength = Number(value);
  if (!Number.isInteger(strength) || strength < 0 || strength > 100) {
    throw new Error("sensor strength must be an integer between 0 and 100");
  }
  return strength;
}

export function parseScanRadius(value: string) {
  const radius = Number(value);
  if (!Number.isInteger(radius) || radius < 0 || radius > 5) {
    throw new Error("scan radius must be an integer between 0 and 5");
  }
  return radius;
}

export function formatNumber(value: number) {
  return Number(value.toFixed(5)).toString();
}

export function formatTicksAsHours(ticks: number) {
  return `${formatNumber(ticks)} ticks (${formatNumber(ticks / 3600)} hours)`;
}

export function formatJsonField(value: unknown) {
  if (value === undefined || value === null) {
    return "none";
  }

  return JSON.stringify(value);
}
