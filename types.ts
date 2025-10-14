export interface InputState {
  projectName: string;
  room: {
    length: number | '';
    width: number | '';
    height: number | '';
    wallType: 'insulated' | 'not_insulated';
    tempDifference: number | '';
  };
  people: {
    count: number | '';
    activity: 'sitting' | 'light_work';
  };
  windows: {
    count: number | '';
    width: number | '';
    height: number | '';
    type: 'single_pane' | 'double_pane';
  };
  lighting: {
    wattage: number | '';
  };
  appliances: {
    wattage: number | '';
  };
  infiltration: {
    ach: number | '';
  };
  ductLength: number | '';
}

export interface ResultsState {
  loads: {
    peopleW: number;
    windowsW: number;
    lightingW: number;
    appliancesW: number;
    wallsAndCeilingW: number;
    infiltrationW: number;
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
