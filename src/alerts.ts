import { randomUUID } from "node:crypto";
import type { LocalRegistration } from "./habitat";

export type AlertSubject = { type: "human" | "module"; id: string };
export type AlertSeverity = "info" | "warning" | "critical";
export type AlertStatus = "open" | "acknowledged" | "resolved";

export type HabitatAlert = {
  id: string;
  code: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  status: AlertStatus;
  source: string;
  openedAt: string;
  lastObservedAt: string;
  occurrenceCount: number;
  details?: Record<string, string | number | boolean>;
  subject?: AlertSubject;
  acknowledgedAt?: string;
  resolvedAt?: string;
};

export type AlertObservation = Omit<HabitatAlert, "id" | "status" | "openedAt" | "lastObservedAt" | "occurrenceCount"> & {
  now?: string;
};

function sameSubject(left?: AlertSubject, right?: AlertSubject) {
  return left?.type === right?.type && left?.id === right?.id;
}

function contractAllowsAlert(registration: LocalRegistration, alert: HabitatAlert) {
  const required = registration.contracts?.alerts.schema.required;
  if (!Array.isArray(required)) {
    return;
  }

  for (const field of required) {
    if (alert[field as keyof HabitatAlert] === undefined) {
      throw new Error(`Alert does not satisfy the registered contract: missing ${field}.`);
    }
  }
}

export function observeAlert(registration: LocalRegistration, observation: AlertObservation): HabitatAlert {
  const now = observation.now ?? new Date().toISOString();
  const alerts = registration.alerts ?? [];
  const existing = alerts.find((alert) =>
    alert.code === observation.code && alert.status !== "resolved" && sameSubject(alert.subject, observation.subject),
  );

  if (existing) {
    existing.lastObservedAt = now;
    existing.occurrenceCount += 1;
    existing.description = observation.description;
    existing.details = observation.details;
    contractAllowsAlert(registration, existing);
    registration.alerts = alerts;
    return existing;
  }

  const alert: HabitatAlert = {
    ...observation,
    id: `alert_${randomUUID().replaceAll("-", "_")}`,
    status: "open",
    openedAt: now,
    lastObservedAt: now,
    occurrenceCount: 1,
  };
  contractAllowsAlert(registration, alert);
  alerts.push(alert);
  registration.alerts = alerts;
  return alert;
}

export function resolveAlertCondition(
  registration: LocalRegistration,
  code: string,
  subject?: AlertSubject,
  now = new Date().toISOString(),
) {
  for (const alert of registration.alerts ?? []) {
    if (alert.code === code && alert.status !== "resolved" && sameSubject(alert.subject, subject)) {
      alert.status = "resolved";
      alert.resolvedAt = now;
      alert.lastObservedAt = now;
    }
  }
}

export function acknowledgeAlert(registration: LocalRegistration, id: string, now = new Date().toISOString()) {
  const alert = (registration.alerts ?? []).find((entry) => entry.id === id);
  if (!alert) {
    throw new Error(`Alert not found: ${id}`);
  }
  if (alert.status === "resolved") {
    throw new Error(`Alert is already resolved: ${id}`);
  }
  alert.status = "acknowledged";
  alert.acknowledgedAt = now;
  return alert;
}

export function listAlerts(registration: LocalRegistration) {
  return [...(registration.alerts ?? [])];
}
