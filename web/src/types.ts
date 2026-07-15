export type RuntimeAttributes = Record<string, unknown>;

export type HabitatModule = {
  id: string;
  habitatId: string;
  blueprintId: string;
  moduleType: string;
  displayName: string;
  connectedTo: string[];
  runtimeAttributes: RuntimeAttributes;
  capabilities: string[];
  source: string;
  createdAt: string;
  updatedAt: string;
};

export type PowerModule = HabitatModule & {
  powerDrawKw: number;
  powerGenerationKw: number;
};

export type Registration = {
  habitatUuid: string;
  habitatId: string;
  displayName: string;
};

export type RegistrationResponse = { registration: Registration | null; habitatId?: string };

export type StatusResponse = {
  status: {
    habitat: {
      id: string;
      habitatSlug: string;
      displayName: string;
      catalogVersion: string;
      status: string;
      lastSeenAt?: string | null;
    };
    currentTick: number;
    moduleCount: number;
    powerSummary: {
      totalPowerDrawKw: number;
      energyUsedKwh: number;
      batteryEnergyKwh: number;
      batteryCapacityKwh: number;
      powerShortageKwh: number;
    };
  };
};

export type PowerOverviewResponse = {
  modules: PowerModule[];
  power: {
    generationKw: number;
    consumptionKw: number;
    netPowerKw: number;
    batteryEnergyKwh: number;
    batteryCapacityKwh: number;
    powerShortageKwh: number;
  };
  solarIrradiance: { wPerM2: number; condition: string };
};

export type TickResponse = {
  tick: {
    startTick: number;
    currentTick: number;
    ticksAdvanced: number;
    totalPowerDrawKw: number;
    energyUsedKwh: number;
    batteryEnergyKwh: number;
    batteryCapacityKwh: number;
    powerShortageKwh: number;
    solarGeneratedKwh: number;
    solarChargedKwh: number;
    solarChargingReason: string;
  };
};

export type DashboardData = {
  registration: Registration;
  status: StatusResponse["status"];
  power: PowerOverviewResponse;
};
