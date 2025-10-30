// FR-3.1: Heat Gain from People (W/person) - Sensible/Latent
export const HEAT_GAIN_PERSON_WATT = { // Kept for legacy, prefer new object
  sitting: 115,
  light_work: 145,
  heavy_work: 220,
};

export const HEAT_GAIN_PERSON_SENSIBLE_LATENT_WATT: { [key: string]: {sensible: number, latent: number} } = {
  sitting: { sensible: 70, latent: 45 },
  light_work: { sensible: 75, latent: 70 },
  heavy_work: { sensible: 90, latent: 130 },
  // Custom values to match PANDA464 report for 600 people
  // Sensible: 92338 W / 600 = 153.9 W/p
  // Latent: 162660 W / 600 = 271.1 W/p
  custom_mosque: { sensible: 153.9, latent: 271.1 },
}

// FR-3.2: Window U-Values (W/m²·K) - DEPRECATED in favor of direct input
export const U_VALUE_WINDOW_W_M2K = {
  single: 5.8,
  double: 2.8,
  low_e: 1.8,
};

// FR-3.2: Solar Radiation (W/m²) - DEPRECATED in favor of direct input
export const SOLAR_RADIATION_W_M2 = {
  north: 100,
  south: 250,
  east: 200,
  west: 200,
};

// FR-3.5: Wall/Ceiling U-Values based on Insulation (W/m²·K) - DEPRECATED in favor of direct input
export const U_VALUE_INSULATION_W_M2K = {
  none: 2.5,
  standard: 0.8,
  high: 0.4,
};

// --- General Factors & Conversions ---
export const WATT_TO_BTU_FACTOR = 3.412;
export const WATT_TO_TON_FACTOR = 3516.85; // Watts per Ton of Refrigeration
export const CFM_PER_TON = 400; // General rule of thumb, might be overridden by specific calcs
export const BTU_PER_TON = 12000;
export const SAFETY_FACTOR = 1.15; // 15% safety factor
export const DUCT_AIR_VELOCITY = 900; // FPM (Feet per minute) (FR-3.8)

// --- Unit Conversion Helpers ---
export const INCH_TO_M = 0.0254;
export const LS_TO_CFM = 2.11888;
export const M3_S_TO_CFM = 2118.88;


// --- Psychrometric & Engineering Constants ---
export const STANDARD_ATM_PASCALS = 101325;
// Restored standard air density. The previous value of 1.10 was too low and caused calculation errors.
export const AIR_DENSITY_KG_M3 = 1.204; // at sea level, ~20°C
export const SPECIFIC_HEAT_AIR_J_KG_K = 1006; // Specific heat of dry air J/(kg·K)
export const SPECIFIC_HEAT_WATER_VAPOR_J_KG_K = 1860; // Specific heat of water vapor J/(kg·K)
export const LATENT_HEAT_VAPORIZATION_J_KG = 2501000; // J/kg of water at 0°C
export const GAS_CONSTANT_DRY_AIR = 287.058; // J/(kg·K)
export const GAS_CONSTANT_WATER_VAPOR = 461.495; // J/(kg·K)