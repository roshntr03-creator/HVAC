
export const HEAT_GAIN_PERSON_WATT = {
  sitting: 100, // Watt/person
  light_work: 120, // Watt/person
};

// Kept for legacy calculation based on existing form inputs
export const U_VALUE_WALL = {
  insulated: 0.07, // BTU/hr·ft²·°F for well-insulated wall
  not_insulated: 0.25, // For a standard block wall
};

// Kept for legacy calculation based on existing form inputs
export const U_VALUE_WINDOW = {
  single_pane: 1.1,
  double_pane: 0.5,
};

// Kept for legacy calculation based on existing form inputs
export const SHGC_WINDOW = { // Solar Heat Gain Coefficient
  single_pane: 0.7,
  double_pane: 0.5,
};
export const SOLAR_FACTOR = 200; // Simplified solar radiation factor in BTU/hr·ft²

export const WATT_TO_BTU_FACTOR = 3.412;
export const CFM_PER_TON = 400;
export const BTU_PER_TON = 12000;
export const SAFETY_FACTOR = 1.20; // 20% safety factor

export const DUCT_AIR_VELOCITY = 900; // FPM (Feet per minute) for residential

// Unit Conversion
export const FT_TO_M = 0.3048;
export const SQFT_TO_SQM = 0.092903;
export const INCH_TO_M = 0.0254;
