export interface InputState {
  projectName: string;
  // Step 1
  room: {
    length: number | ''; // meters
    width: number | ''; // meters
    height: number | ''; // meters
  };
  // Step 2
  people: {
    count: number | '';
    activity: 'sitting' | 'light_work' | 'heavy_work';
  };
  lighting: {
    wattage: number | '';
  };
  // Step 3
  windows: {
    area: number | ''; // m²
    glassType: 'single' | 'double' | 'low_e';
    direction: 'north' | 'south' | 'east' | 'west';
    shading: boolean;
  };
  // Step 4
  appliances: {
    wattage: number | '';
  };
  wallsAndCeiling: {
    wallArea: number | ''; // m²
    ceilingArea: number | ''; // m²
    insulationType: 'none' | 'standard' | 'high';
  };
  // Step 5
  environment: {
    outdoorTemp: number | ''; // C
    indoorTemp: number | ''; // C
    buildingType: 'residential' | 'commercial' | 'industrial';
  };
}

export interface ResultsState {
  loads: {
    peopleW: number;
    windowsW: number;
    lightingW: number;
    appliancesW: number;
    wallsAndCeilingW: number;
    subTotalW: number;
    totalLoadW: number;
    totalLoadBtu: number;
    totalLoadTons: number;
  };
  airflow: {
    cfm: number;
    velocityFpm: number;
  };
  ductSizing: {
    areaSqFt: number;
    roundDiameterIn: number;
    rectWidthIn: number;
    rectHeightIn: number;
  };
  materials: { // for 10m length
    sheetMetalM2: number;
    insulationM2: number;
    flanges: number;
    screws: number;
  };
}


export interface Project {
  id: string;
  name: string;
  inputs: InputState;
  results: ResultsState;
  createdAt: string;
}
