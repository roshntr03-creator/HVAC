// FR-3.1: Heat Gain from People (W/person)
export const HEAT_GAIN_PERSON_WATT = {
  sitting: 100,
  light_work: 120,
  heavy_work: 200,
};

// FR-3.2: Window U-Values (W/m²·K)
export const U_VALUE_WINDOW_W_M2K = {
  single: 5.8,
  double: 2.8,
  low_e: 1.8,
};

// FR-3.2: Solar Radiation (W/m²)
export const SOLAR_RADIATION_W_M2 = {
  north: 100,
  south: 250,
  east: 200,
  west: 200,
};

// FR-3.5: Wall/Ceiling U-Values based on Insulation (W/m²·K)
export const U_VALUE_INSULATION_W_M2K = {
  none: 2.5,
  standard: 0.8,
  high: 0.4,
};

// --- General Factors & Conversions ---
export const WATT_TO_BTU_FACTOR = 3.412;
export const WATT_TO_TON_FACTOR = 3516.85; // Watts per Ton of Refrigeration
export const CFM_PER_TON = 400;
export const BTU_PER_TON = 12000;
export const SAFETY_FACTOR = 1.20; // 20% safety factor (FR-3.6)
export const DUCT_AIR_VELOCITY = 900; // FPM (Feet per minute) (FR-3.8)

// --- Unit Conversion Helpers ---
export const INCH_TO_M = 0.0254;
