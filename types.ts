export interface InputState {
  projectName: string;
  preparedBy: string;
  location: string;
  
  // Project & System Details
  system: {
    equipmentClass: 'pkg_roof' | 'split_dx' | 'chiller_fcu';
    airSystemType: 'szcav' | 'vav';
    fanStaticPa: number | '';
    fanEfficiency: number | '';
    safetyFactor: number | '';
    designAirflowLs: number | '';
  };

  // Zone & Space Data
  zone: {
    floorArea: number | ''; // m²
    ceilingHeight: number | ''; // m
  };

  // Internal Loads
  people: {
    count: number | '';
    activity: 'sitting' | 'light_work' | 'heavy_work' | 'custom_mosque';
  };
  lighting: {
    loadW: number | ''; // Watts
  };
  equipment: {
    loadW: number | ''; // Watts
  };

  // Envelope Loads
  envelope: {
    windowArea: number | ''; // m²
    windowUValue: number | ''; // W/m²K
    wallArea: number | ''; // m²
    wallUValue: number | ''; // W/m²K
    roofArea: number | ''; // m²
    roofUValue: number | ''; // W/m²K
    solarLoadW: number | ''; // Watts (from windows)
  };

  // Ventilation & Infiltration
  ventilation: {
    lsPerPerson: number | ''; // L/s per person
    infiltrationACH: number | ''; // Air Changes per Hour
  };

  // Design Conditions
  conditions: {
    outdoorDB: number | ''; // Dry-Bulb Temp °C
    outdoorWB: number | ''; // Wet-Bulb Temp °C
    indoorDB: number | ''; // Dry-Bulb Temp °C
    indoorRH: number | ''; // Relative Humidity %
    designSupplyTemp: number | ''; // Supply Air Temp °C
    winterOutdoorDB: number | '';
  };
}

export interface PsychrometricPoint {
    name: string;
    dryBulb: number;      // °C
    humidityRatio: number;// kg/kg
}

export interface PsychrometricTableRow {
    component: string;
    location: string;
    dryBulbC: number;
    specificHumidity: number;
    airflowLs: number;
    co2LevelPpm: number;
    sensibleHeatW: number;
    latentHeatW: number;
}
export interface PsychrometricZoneData {
    sensibleLoadW: number;
    thermostatMode: string;
    zoneConditionW: number;
    zoneTempC: number;
    airflowLs: number;
    co2LevelPpm: number;
    terminalHeatingCoilW: number;
    zoneHeatingUnitW: number;
}


export interface ResultsState {
  projectInfo: {
    projectName: string;
    preparedBy: string;
    location: string;
    floorArea: number;
    date: string;
    time: string;
    altitude: number;
  };
  
  airSystemSizingSummary: {
    airSystemName: string;
    equipmentClass: string;
    airSystemType: string;
    numberOfZones: number;
    location: string;
    calculationMonths: string;
    sizingData: string;
    zoneLssSizing: string;
    spaceLssSizing: string;
    cooling: {
      totalCoilLoadKW: number;
      sensibleCoilLoadKW: number;
      coilAirflowLs: number;
      maxBlockLs: number;
      sumOfPeakLs: number;
      sensibleHeatRatio: number;
      sqmPerKw: number;
      wattsPerSqm: number;
      loadOccursAt: string;
      outdoorAirDB: number;
      outdoorAirWB: number;
      enteringDB: number;
      enteringWB: number;
      leavingDB: number;
      leavingWB: number;
      coilADP: number;
      bypassFactor: number;
      resultingRH: number;
      designSupplyTemp: number;
    };
    heating: {
      maxCoilLoadKW: number;
      coilLsAtDesHtg: number;
      maxCoilLs: number;
      loadOccursAt: string;
      wattsPerSqm: number;
      enteringDB: number;
      leavingDB: number;
    };
    supplyFan: {
      actualMaxLs: number;
      standardLs: number; // Corrected for density
      actualMaxLssqm: number;
      fanMotorBHP: number;
      fanMotorKW: number;
      fanStaticPa: number;
    };
    ventilation: {
      designAirflowLs: number;
      lsPerSqm: number;
      lsPerPerson: number;
    };
  };

  zoneSizingSummary: {
    zoneName: string;
    coolingSensibleKW: number;
    designAirflowLs: number;
    minAirflowLs: number;
    timeOfPeakLoad: string;
    heatingLoadKW: number;
    floorArea: number;
    lsPerSqm: number;
  };

  spaceLoadsAndAirflows: {
    spaceName: string;
    coolingSensibleKW: number;
    timeOfLoad: string;
    airflowLs: number;
    heatingLoadKW: number;
    floorArea: number;
    spaceLsPerSqm: number;
  };

  designLoadSummary: {
    cooling: {
        oa_db_wb: string;
        details: { [key: string]: { details: string; sensibleW: number; latentW: number; }};
    },
    heating: {
        oa_db_wb: string;
        details: { [key: string]: { details: string; sensibleW: number; latentW: number; }};
    },
    totalConditioning: {
        sensibleW: number;
        latentW: number;
        sensibleW_heating: number;
        latentW_heating: number;
    }
  };

  psychrometrics: {
    coolingDay: string;
    cooling_points: PsychrometricPoint[];
    cooling_table: PsychrometricTableRow[];
    cooling_zone_data: PsychrometricZoneData;
    heating_table: PsychrometricTableRow[];
    heating_zone_data: PsychrometricZoneData;
  };
  
  legacy: {
    totalLoadTons: number;
    airflowCFM: number;
  }
}

export interface Project {
  id: string;
  name: string;
  inputs: InputState;
  results: ResultsState;
  createdAt: string;
}