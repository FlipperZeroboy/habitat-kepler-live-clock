import { useEffect, useMemo, useState } from "react";
import { useDashboard, type DashboardController } from "./use-dashboard";
import { useAutoTick } from "./use-auto-tick";
import type { PowerModule } from "./types";
import "./styles.css";

const presets = [
  { label: "1 tick", value: 1 },
  { label: "1 min", value: 60 },
  { label: "10 min", value: 600 },
  { label: "1 hour", value: 3600 },
];

function formatNumber(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(value);
}

function formatPower(value: number) {
  return `${formatNumber(value)} kW`;
}

function statusLabel(module: PowerModule) {
  return String(module.runtimeAttributes.status ?? "offline");
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="error-banner" role="alert"><span>{message}</span><button className="button button-quiet" onClick={onRetry}>Retry</button></div>;
}

function RegistrationEmpty({ controller }: { controller: DashboardController }) {
  const [name, setName] = useState("");
  return <section className="empty-state panel">
    <div className="empty-icon">⌁</div>
    <p className="eyebrow">Habitat offline</p>
    <h2>Register a Habitat to begin</h2>
    <p className="muted">The dashboard reads live state from the REST backend after registration.</p>
    <form className="register-form" onSubmit={(event) => { event.preventDefault(); if (name.trim()) void controller.register(name.trim()); }}>
      <label htmlFor="habitat-name">Display name</label>
      <div className="inline-form"><input id="habitat-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Artemis Ridge" /><button className="button button-primary" disabled={!name.trim() || controller.mutating !== null}>Register</button></div>
    </form>
  </section>;
}

function ModuleRow({ module, controller }: { module: PowerModule; controller: DashboardController }) {
  const status = statusLabel(module);
  const isTransitioning = controller.mutating === `module:${module.id}`;
  const nextStatus = status === "offline" ? "online" : "offline";
  const currentEnergy = module.runtimeAttributes.currentEnergyKwh;
  const capacity = module.runtimeAttributes.energyStorageKwh;
  return <tr>
    <td><div className="module-name"><span className={`module-dot ${status}`} /> <span><strong>{module.displayName}</strong><small>{module.moduleType}</small></span></div></td>
    <td><span className={`status-pill ${status}`}>{status}</span></td>
    <td className="numeric">{formatPower(module.powerDrawKw)}</td>
    <td className="numeric">{formatPower(module.powerGenerationKw)}</td>
    <td className="numeric">{typeof currentEnergy === "number" && typeof capacity === "number" ? `${formatNumber(currentEnergy)} / ${formatNumber(capacity)} kWh` : "—"}</td>
    <td className="table-action"><button className="button button-small" disabled={isTransitioning || controller.mutating !== null} onClick={() => void controller.setModuleStatus(module.id, nextStatus)}>{isTransitioning ? "Saving…" : `Set ${nextStatus}`}</button></td>
  </tr>;
}

function clockModeLabel(mode: "manual" | "kepler") {
  return mode === "manual" ? "Manual" : "Kepler";
}

export function AutoTickControl({
  mode,
  manualTicksAllowed,
  mutating,
  running,
  onToggle,
}: {
  mode: "manual" | "kepler";
  manualTicksAllowed: boolean;
  mutating: boolean;
  running: boolean;
  onToggle: () => void;
}) {
  return <div className="auto-tick-control" aria-live="polite">
    <div className="auto-tick-copy">
      <p className="eyebrow">Automatic simulation</p>
      <strong>{running ? "Auto Tick on" : "Auto Tick off"}</strong>
      <span className="muted">Clock mode: {clockModeLabel(mode)}</span>
      <span className="muted">{manualTicksAllowed ? "One in-game tick per second" : "Unavailable while Kepler listening is on"}</span>
    </div>
    <button className="button button-primary auto-tick-button" disabled={!manualTicksAllowed || mutating} onClick={onToggle}>{running ? "Stop Auto Tick" : "Start Auto Tick"}</button>
  </div>;
}

function Dashboard({ controller }: { controller: DashboardController }) {
  const { data } = controller;
  const [customTicks, setCustomTicks] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">(() => (localStorage.getItem("habitat-theme") as "dark" | "light" | null) ?? "dark");
  const modules = data?.power.modules ?? [];
  const latestTick = useMemo(() => data?.status.currentTick ?? 0, [data?.status.currentTick]);
  const autoTick = useAutoTick({
    tick: () => controller.advanceTicks(1),
    manualTicksAllowed: data.clock.manualTicksAllowed,
  });

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("habitat-theme", theme); }, [theme]);
  useEffect(() => { if (!data.clock.manualTicksAllowed && autoTick.running) autoTick.stop(); }, [autoTick, data.clock.manualTicksAllowed]);

  function submitCustomTicks(event: React.FormEvent) {
    event.preventDefault();
    const count = Number(customTicks);
    if (Number.isInteger(count) && count > 0) { void controller.advanceTicks(count); setCustomTicks(""); }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">✦</span><span>HABITAT<br /><em>COMMAND</em></span></div>
      <nav className="side-nav" aria-label="Primary navigation"><a className="active" href="#overview"><span>▦</span> Dashboard</a><a href="#power"><span>◒</span> Power</a><a href="#modules"><span>⌘</span> Modules</a><a href="#simulation"><span>↗</span> Simulation</a></nav>
      <div className="sidebar-footer"><span className="connection-dot" /> Backend connected<div className="sidebar-version">REST state bridge</div></div>
    </aside>
    <main className="main-content" id="overview">
      <header className="topbar"><div><p className="eyebrow">Operations dashboard</p><h1>{data.registration.displayName}</h1><p className="subline">{data.registration.habitatId} <span className="separator">·</span> {data.status.habitat.status}</p></div><div className="topbar-actions"><button className="icon-button" aria-label="Toggle color theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "☼" : "☾"}</button><button className="button button-quiet" onClick={() => void controller.refresh()} disabled={controller.loading}>↻ Refresh</button></div></header>
      {controller.error && <ErrorBanner message={controller.error} onRetry={() => void controller.refresh()} />}
      <section className="hero-grid" id="power"><div className="hero-card panel"><div><p className="eyebrow">Habitat status</p><h2>All systems in view</h2><p className="muted">Tick {formatNumber(latestTick)} · {formatNumber(data.status.moduleCount)} modules reporting</p></div><span className="hero-orbit">◎</span></div><div className="solar-card panel"><div><p className="eyebrow">Solar conditions</p><h2>{data.power.solarIrradiance.condition}</h2><p className="muted">{formatNumber(data.power.solarIrradiance.wPerM2)} W/m² irradiance</p></div><span className="solar-glyph">☀</span></div></section>
      <section className="metric-grid" aria-label="Power summary"><MetricCard label="Generation" value={formatPower(data.power.power.generationKw)} note="available now" tone="cyan" /><MetricCard label="Consumption" value={formatPower(data.power.power.consumptionKw)} note="effective draw" tone="orange" /><MetricCard label="Net power" value={`${data.power.power.netPowerKw >= 0 ? "+" : ""}${formatPower(data.power.power.netPowerKw)}`} note={data.power.power.netPowerKw >= 0 ? "surplus" : "shortage"} tone={data.power.power.netPowerKw >= 0 ? "lime" : "orange"} /><MetricCard label="Battery reserve" value={`${formatNumber(data.power.power.batteryEnergyKwh)} kWh`} note={`of ${formatNumber(data.power.power.batteryCapacityKwh)} kWh`} tone="violet" /></section>
      <section className="content-grid" id="simulation"><div className="panel simulation-panel"><div className="section-heading"><div><p className="eyebrow">Simulation control</p><h2>Advance Habitat time</h2></div><span className="tick-badge">T+{formatNumber(latestTick)}</span></div><p className="muted">Apply server-side ticks and refresh the shared state.</p><AutoTickControl mode={data.clock.mode} manualTicksAllowed={data.clock.manualTicksAllowed} mutating={controller.mutating !== null} running={autoTick.running} onToggle={() => autoTick.running ? autoTick.stop() : autoTick.start()} /><div className="preset-grid">{presets.map((preset) => <button key={preset.value} className="preset-button" disabled={controller.mutating !== null} onClick={() => void controller.advanceTicks(preset.value)}><strong>{preset.label}</strong><small>{formatNumber(preset.value)} seconds</small></button>)}</div><form className="custom-tick" onSubmit={submitCustomTicks}><label htmlFor="custom-ticks">Custom ticks</label><div className="inline-form"><input id="custom-ticks" inputMode="numeric" pattern="[0-9]*" value={customTicks} onChange={(event) => setCustomTicks(event.target.value)} placeholder="Positive whole number" /><button className="button button-primary" disabled={controller.mutating !== null || !/^[1-9]\d*$/.test(customTicks)}>Advance</button></div></form></div><div className="panel balance-panel"><div className="section-heading"><div><p className="eyebrow">Power balance</p><h2>Live energy flow</h2></div><span className="live-badge"><span /> LIVE</span></div><div className="balance-visual"><div className="balance-ring"><strong>{Math.round(Math.max(0, Math.min(100, data.power.power.batteryCapacityKwh ? data.power.power.batteryEnergyKwh / data.power.power.batteryCapacityKwh * 100 : 0)))}%</strong><small>reserve</small></div><div className="balance-lines"><BalanceLine label="Generation" value={formatPower(data.power.power.generationKw)} color="cyan" /><BalanceLine label="Consumption" value={formatPower(data.power.power.consumptionKw)} color="orange" /><BalanceLine label="Shortage" value={`${formatNumber(data.power.power.powerShortageKwh)} kWh`} color="violet" /></div></div></div></section>
      <section className="panel modules-panel" id="modules"><div className="section-heading"><div><p className="eyebrow">Habitat modules</p><h2>Module telemetry</h2></div><span className="count-badge">{modules.length} total</span></div>{modules.length === 0 ? <div className="table-empty">No modules are registered for this Habitat.</div> : <div className="table-wrap"><table><thead><tr><th>Module</th><th>Status</th><th>Power draw</th><th>Generation</th><th>Battery</th><th /></tr></thead><tbody>{modules.map((module) => <ModuleRow key={module.id} module={module} controller={controller} />)}</tbody></table></div>}</section>
      <section className="danger-zone panel"><div><p className="eyebrow danger-eyebrow">Destructive action</p><h2>Unregister Habitat</h2><p className="muted">This removes the current registration and returns the Habitat to its starter state when registered again.</p></div><button className="button button-danger" disabled={controller.mutating !== null} onClick={() => { if (window.confirm("Unregister this Habitat? The current registration will be removed and re-registration returns it to starter state.")) void controller.unregister(); }}>Unregister</button></section>
    </main>
  </div>;
}

function MetricCard({ label, value, note, tone }: { label: string; value: string; note: string; tone: string }) { return <div className={`metric-card panel ${tone}`}><p className="eyebrow">{label}</p><strong>{value}</strong><span>{note}</span></div>; }
function BalanceLine({ label, value, color }: { label: string; value: string; color: string }) { return <div className="balance-line"><span><i className={color} /> {label}</span><strong>{value}</strong></div>; }

export function App() {
  const controller = useDashboard();
  useEffect(() => { void controller.refresh(); }, [controller.refresh]);
  if (controller.loading && !controller.data && controller.registered === null) return <main className="full-state"><div className="loader" /><p>Connecting to Habitat backend…</p></main>;
  if (controller.registered === false) return <main className="full-state"><RegistrationEmpty controller={controller} />{controller.error && <ErrorBanner message={controller.error} onRetry={() => void controller.refresh()} />}</main>;
  if (!controller.data) return <main className="full-state"><ErrorBanner message={controller.error ?? "Habitat state is unavailable."} onRetry={() => void controller.refresh()} /></main>;
  return <Dashboard controller={controller} />;
}
