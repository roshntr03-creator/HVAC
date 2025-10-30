import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { InputState, ResultsState, Project, PsychrometricPoint, PsychrometricTableRow, PsychrometricZoneData } from './types';
import { useLanguage } from './LanguageContext';
import { 
  HEAT_GAIN_PERSON_SENSIBLE_LATENT_WATT, WATT_TO_TON_FACTOR,
  LS_TO_CFM, STANDARD_ATM_PASCALS, 
  SPECIFIC_HEAT_AIR_J_KG_K, LATENT_HEAT_VAPORIZATION_J_KG, AIR_DENSITY_KG_M3
} from './constants';
import { BuildingIcon, UsersIcon, LightbulbIcon, DocumentReportIcon, FolderIcon, PrintIcon, CheckCircleIcon, ThermometerIcon } from './Icons';

// --- Psychrometric Helper Functions ---
const getSatVaporPressure = (T_db: number): number => {
    const C1 = -5.6745359e3, C2 = 6.3925247e0, C3 = -9.677843e-3, C4 = 6.2215701e-7, C5 = 2.0747825e-9, C6 = -9.484024e-13, C7 = 4.1635019e0;
    const T_k = T_db + 273.15;
    if (T_db < 0) { // For ice
        const C8 = -5.8666426e3, C9 = 2.2328702e1, C10 = 1.3938700e-2, C11 = -3.4262402e-5, C12 = 2.7040955e-8, C13 = 6.7063522e-1;
        return Math.exp(C8/T_k + C9 + C10*T_k + C11*T_k**2 + C12*T_k**3 + C13*Math.log(T_k));
    }
    return Math.exp(C1/T_k + C2 + C3*T_k + C4*T_k**2 + C5*T_k**3 + C6*T_k**4 + C7*Math.log(T_k));
};

const getHumidityRatioFromRH = (T_db: number, RH: number): number => {
    const P_ws = getSatVaporPressure(T_db);
    const P_w = RH / 100 * P_ws;
    return 0.621945 * (P_w / (STANDARD_ATM_PASCALS - P_w));
};

const getHumidityRatioFromWB = (T_db: number, T_wb: number): number => {
    const Pws_wb = getSatVaporPressure(T_wb);
    const Ws_wb = 0.621945 * Pws_wb / (STANDARD_ATM_PASCALS - Pws_wb);
    const Cpa = SPECIFIC_HEAT_AIR_J_KG_K;
    const hfg = LATENT_HEAT_VAPORIZATION_J_KG;
    const numerator = Ws_wb * (hfg + 1840 * T_wb) - Cpa * (T_db - T_wb);
    const denominator = hfg + 1840 * T_db;
    if (Math.abs(denominator) < 1e-6) return Ws_wb;
    return Math.max(0, numerator/denominator);
};


const getEnthalpy = (T_db: number, W: number): number => {
    return (1.006 * T_db + W * (2501 + 1.86 * T_db)); // in kJ/kg
};

const getPsychrometrics = (name: string, T_db: number, W: number): PsychrometricPoint => {
    return { name, dryBulb: T_db, humidityRatio: W };
}
// --- End Psychro Helpers ---

const placeholderInputs: InputState = {
  projectName: "PANDA464",
  preparedBy: "ENG",
  location: "Dhahran, Saudi Arabia",
  system: { equipmentClass: 'pkg_roof', airSystemType: 'szcav', fanStaticPa: 750, fanEfficiency: 65, safetyFactor: 15, designAirflowLs: 18951 },
  zone: { floorArea: 2055, ceilingHeight: 4 },
  people: { count: 600, activity: 'custom_mosque' }, // Note: 'custom_mosque' is used to match the explicit loads from HAP report.
  lighting: { loadW: 82194 },
  equipment: { loadW: 41098 },
  envelope: {
    windowArea: 0, windowUValue: 0,
    wallArea: 0, wallUValue: 0,
    roofArea: 0, roofUValue: 0,
    solarLoadW: 0,
  },
  ventilation: { lsPerPerson: 4.83, infiltrationACH: 0 },
  conditions: {
    outdoorDB: 43.9, outdoorWB: 21.7,
    indoorDB: 24.7, indoorRH: 64,
    designSupplyTemp: 14.4, // This will be calculated, but placeholder reflects target
    winterOutdoorDB: 7.2,
  },
};

const emptyInputs: InputState = {
    projectName: '',
    preparedBy: '',
    location: '',
    system: { equipmentClass: 'pkg_roof', airSystemType: 'szcav', fanStaticPa: '', fanEfficiency: '', safetyFactor: '', designAirflowLs: '' },
    zone: { floorArea: '', ceilingHeight: '' },
    people: { count: '', activity: 'light_work' },
    lighting: { loadW: '' },
    equipment: { loadW: '' },
    envelope: {
        windowArea: '', windowUValue: '',
        wallArea: '', wallUValue: '',
        roofArea: '', roofUValue: '',
        solarLoadW: '',
    },
    ventilation: { lsPerPerson: '', infiltrationACH: '' },
    conditions: {
        outdoorDB: '', outdoorWB: '',
        indoorDB: '', indoorRH: '',
        designSupplyTemp: '',
        winterOutdoorDB: '',
    },
};

interface CalculatorPageProps {
  onNavigate: (page: 'home' | 'projects') => void;
  onSaveProject: (inputs: InputState, results: ResultsState) => void;
  activeProject: Project | null;
}

const LanguageSwitcher = () => {
  const { language, setLanguage } = useLanguage();
  const toggleLanguage = () => setLanguage(language === 'ar' ? 'en' : 'ar');
  return (
    <button onClick={toggleLanguage} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded transition-colors">
      {language === 'ar' ? 'English' : 'العربية'}
    </button>
  );
};

const CalculatorPage: React.FC<CalculatorPageProps> = ({ onNavigate, onSaveProject, activeProject }) => {
  const [inputs, setInputs] = useState<InputState>(emptyInputs);
  const [results, setResults] = useState<ResultsState | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const { t } = useLanguage();

  const STEPS = useMemo(() => [
    { number: 1, title: t('calculator_steps_1'), icon: <FolderIcon /> },
    { number: 2, title: t('calculator_steps_2'), icon: <UsersIcon /> },
    { number: 3, title: t('calculator_steps_3'), icon: <BuildingIcon /> },
    { number: 4, title: t('calculator_steps_4'), icon: <ThermometerIcon className="h-6 w-6" /> },
    { number: 5, title: t('calculator_steps_6'), icon: <DocumentReportIcon /> }
  ], [t]);


  useEffect(() => {
    if (activeProject) {
      setInputs(activeProject.inputs);
      setResults(activeProject.results);
      setCurrentStep(5);
    } else {
      setInputs(emptyInputs);
      setResults(null);
      setCurrentStep(1);
    }
  }, [activeProject]);

  const calculateAll = useCallback(() => {
    const getNum = (val: number | '', fallback = 0) => (typeof val === 'number' && isFinite(val) && val > 0) ? val : fallback;
    const getNumCanBeZero = (val: number | '', fallback = 0) => (typeof val === 'number' && isFinite(val)) ? val : fallback;
    
    // --- EFFECTIVE INPUTS with SANE DEFAULTS ---
    const i = {
        projectName: inputs.projectName || 'Untitled Project',
        preparedBy: inputs.preparedBy || 'N/A',
        location: inputs.location || 'N/A',
        system: {
            ...inputs.system,
            fanStaticPa: getNumCanBeZero(inputs.system.fanStaticPa),
            fanEfficiency: getNum(inputs.system.fanEfficiency, 65), // Assume 65% if not provided
            safetyFactor: getNumCanBeZero(inputs.system.safetyFactor),
            designAirflowLs: getNum(inputs.system.designAirflowLs)
        },
        zone: {
            floorArea: getNum(inputs.zone.floorArea, 1), // Avoid division by zero
            ceilingHeight: getNum(inputs.zone.ceilingHeight, 3), // Assume 3m
        },
        people: {
            count: getNumCanBeZero(inputs.people.count),
            activity: inputs.people.activity
        },
        lighting: { loadW: getNumCanBeZero(inputs.lighting.loadW) },
        equipment: { loadW: getNumCanBeZero(inputs.equipment.loadW) },
        envelope: {
            windowArea: getNumCanBeZero(inputs.envelope.windowArea), windowUValue: getNumCanBeZero(inputs.envelope.windowUValue),
            wallArea: getNumCanBeZero(inputs.envelope.wallArea), wallUValue: getNumCanBeZero(inputs.envelope.wallUValue),
            roofArea: getNumCanBeZero(inputs.envelope.roofArea), roofUValue: getNumCanBeZero(inputs.envelope.roofUValue),
            solarLoadW: getNumCanBeZero(inputs.envelope.solarLoadW),
        },
        ventilation: {
            lsPerPerson: getNumCanBeZero(inputs.ventilation.lsPerPerson),
            infiltrationACH: getNumCanBeZero(inputs.ventilation.infiltrationACH),
        },
        conditions: {
            ...inputs.conditions,
            outdoorDB: getNum(inputs.conditions.outdoorDB, 35), outdoorWB: getNum(inputs.conditions.outdoorWB, 24),
            indoorDB: getNum(inputs.conditions.indoorDB, 24), indoorRH: getNum(inputs.conditions.indoorRH, 50),
            winterOutdoorDB: getNum(inputs.conditions.winterOutdoorDB, 5),
        },
    };
    
    // --- LOAD CALCULATIONS (COOLING) ---
    const peopleGains = HEAT_GAIN_PERSON_SENSIBLE_LATENT_WATT[i.people.activity];
    const peopleLoad = { sensible: peopleGains.sensible * i.people.count, latent: peopleGains.latent * i.people.count };
    const lightingLoad = { sensible: i.lighting.loadW, latent: 0 };
    const equipmentLoad = { sensible: i.equipment.loadW, latent: 0 };
    
    const tempDiff = i.conditions.outdoorDB - i.conditions.indoorDB;
    const wallLoad = { sensible: i.envelope.wallArea * i.envelope.wallUValue * tempDiff, latent: 0 };
    const roofLoad = { sensible: i.envelope.roofArea * i.envelope.roofUValue * tempDiff, latent: 0 };
    const windowConductiveLoad = { sensible: i.envelope.windowArea * i.envelope.windowUValue * tempDiff, latent: 0 };
    const windowSolarLoad = { sensible: i.envelope.solarLoadW, latent: 0 };

    const outdoorAirW = getHumidityRatioFromWB(i.conditions.outdoorDB, i.conditions.outdoorWB);
    const indoorAirW = getHumidityRatioFromRH(i.conditions.indoorDB, i.conditions.indoorRH);
    const humidityDiff = Math.max(0, outdoorAirW - indoorAirW); // Infiltration doesn't add moisture if inside is more humid
    
    const zoneVolume = i.zone.floorArea * i.zone.ceilingHeight;
    const infiltrationMassFlow = (i.ventilation.infiltrationACH * zoneVolume / 3600) * AIR_DENSITY_KG_M3;
    const infiltrationLoad = {
        sensible: infiltrationMassFlow * SPECIFIC_HEAT_AIR_J_KG_K * tempDiff,
        latent: infiltrationMassFlow * LATENT_HEAT_VAPORIZATION_J_KG * humidityDiff
    };
    
    const ventilationLs = i.ventilation.lsPerPerson * i.people.count;

    const totalZoneSensibleW = [peopleLoad, lightingLoad, equipmentLoad, wallLoad, roofLoad, windowConductiveLoad, windowSolarLoad, infiltrationLoad].reduce((sum, load) => sum + load.sensible, 0);
    const totalZoneLatentW = [peopleLoad, infiltrationLoad].reduce((sum, load) => sum + load.latent, 0);
    
    const supplyAirflowLs = i.system.designAirflowLs;
    if (supplyAirflowLs === 0) { alert("Design Airflow cannot be zero."); return null; }
    const supplyMassFlow = (supplyAirflowLs / 1000) * AIR_DENSITY_KG_M3;

    // --- FAN CALCULATIONS (CORRECTED) ---
    const supplyAirflowM3s = supplyAirflowLs / 1000;
    const fanEfficiencyDecimal = i.system.fanEfficiency / 100;
    const fanPowerW = (fanEfficiencyDecimal > 0 && i.system.fanStaticPa > 0) ? (supplyAirflowM3s * i.system.fanStaticPa) / fanEfficiencyDecimal : 0;
    const fanPowerKW = fanPowerW / 1000;
    const fanPowerBHP = fanPowerKW * 1.341;
    const fanHeatDeltaT = (supplyMassFlow > 0) ? fanPowerW / (supplyMassFlow * SPECIFIC_HEAT_AIR_J_KG_K) : 0;
    
    // --- PSYCHROMETRIC CALCULATIONS (CORRECTED) ---
    // Calculate the state of the air required to enter the zone
    const T_supply_entering_zone = i.conditions.indoorDB - (totalZoneSensibleW / (supplyMassFlow * SPECIFIC_HEAT_AIR_J_KG_K));
    const W_supply_entering_zone = indoorAirW - (totalZoneLatentW / (supplyMassFlow * LATENT_HEAT_VAPORIZATION_J_KG));
    
    // The fan adds heat, so the air leaving the coil must be colder
    const T_leaving_coil = T_supply_entering_zone - fanHeatDeltaT;
    const W_leaving_coil = W_supply_entering_zone; // Fan adds sensible heat only
    
    const outdoorAir = getPsychrometrics("Outdoor Air", i.conditions.outdoorDB, outdoorAirW);
    const indoorAir = getPsychrometrics("Room Air", i.conditions.indoorDB, indoorAirW);
    const leavingCoilAir = getPsychrometrics("Central Cooling Coil Outlet", T_leaving_coil, W_leaving_coil);
    const supplyAir = getPsychrometrics("Supply Fan Outlet", T_supply_entering_zone, W_supply_entering_zone);
    
    const returnAirflowLs = Math.max(0, supplyAirflowLs - ventilationLs);
    const mixedAirDB = (returnAirflowLs * indoorAir.dryBulb + ventilationLs * outdoorAir.dryBulb) / supplyAirflowLs;
    const mixedAirW = (returnAirflowLs * indoorAir.humidityRatio + ventilationLs * outdoorAir.humidityRatio) / supplyAirflowLs;
    const mixedAir = getPsychrometrics("Mixed Air", mixedAirDB, mixedAirW);

    const ventilationMassFlow = (ventilationLs / 1000) * AIR_DENSITY_KG_M3;
    const ventilationLoad = {
        sensible: ventilationMassFlow * SPECIFIC_HEAT_AIR_J_KG_K * (i.conditions.outdoorDB - i.conditions.indoorDB),
        latent: ventilationMassFlow * LATENT_HEAT_VAPORIZATION_J_KG * (outdoorAirW - indoorAirW)
    };

    const sensibleCoilLoadW = supplyMassFlow * SPECIFIC_HEAT_AIR_J_KG_K * (mixedAir.dryBulb - leavingCoilAir.dryBulb);
    const latentCoilLoadW = supplyMassFlow * LATENT_HEAT_VAPORIZATION_J_KG * (mixedAir.humidityRatio - leavingCoilAir.humidityRatio);
    const totalCoilLoadW = sensibleCoilLoadW + latentCoilLoadW;
    const coilSHR = totalCoilLoadW > 0 ? sensibleCoilLoadW / totalCoilLoadW : 0;
    
    let T_adp = leavingCoilAir.dryBulb - 2;
    for (let iter = 0; iter < 10; iter++) {
        const W_adp = getHumidityRatioFromRH(T_adp, 100);
        T_adp = mixedAir.dryBulb - ((mixedAir.dryBulb - leavingCoilAir.dryBulb) * (mixedAir.humidityRatio - W_adp)) / (mixedAir.humidityRatio - leavingCoilAir.humidityRatio);
    }
    const bypassFactor = (leavingCoilAir.dryBulb - T_adp) / (mixedAir.dryBulb - T_adp);

    const Pws_leaving = getSatVaporPressure(supplyAir.dryBulb);
    const Pw_leaving = (supplyAir.humidityRatio * STANDARD_ATM_PASCALS) / (0.621945 + supplyAir.humidityRatio);
    const resultingRH = (Pw_leaving / Pws_leaving) * 100;
    
    // Apply safety factor
    const finalTotalCoilLoadW = totalCoilLoadW * (1 + i.system.safetyFactor / 100);
    const finalSensibleCoilLoadW = sensibleCoilLoadW * (1 + i.system.safetyFactor / 100);

    // --- HEATING CALCULATIONS ---
    const heatingTempDiff = i.conditions.indoorDB - i.conditions.winterOutdoorDB;
    const heatingWallLoad = i.envelope.wallArea * i.envelope.wallUValue * heatingTempDiff;
    const heatingRoofLoad = i.envelope.roofArea * i.envelope.roofUValue * heatingTempDiff;
    const heatingWindowLoad = i.envelope.windowArea * i.envelope.windowUValue * heatingTempDiff;
    const heatingInfiltrationLoad = infiltrationMassFlow * SPECIFIC_HEAT_AIR_J_KG_K * heatingTempDiff;
    const heatingVentilationLoad = ventilationMassFlow * SPECIFIC_HEAT_AIR_J_KG_K * heatingTempDiff;
    const totalHeatingLoadW = (heatingWallLoad + heatingRoofLoad + heatingWindowLoad + heatingInfiltrationLoad + heatingVentilationLoad) * (1 + i.system.safetyFactor / 100);
    
    const winterMixedAirDB = (returnAirflowLs * i.conditions.indoorDB + ventilationLs * i.conditions.winterOutdoorDB) / supplyAirflowLs;
    const heatingLeavingDB = winterMixedAirDB + (totalHeatingLoadW / (supplyMassFlow * SPECIFIC_HEAT_AIR_J_KG_K));
    
    // --- FINAL RESULTS ASSEMBLY ---
    const newResults: ResultsState = {
        projectInfo: {
            projectName: i.projectName, preparedBy: i.preparedBy, location: i.location,
            floorArea: i.zone.floorArea,
            date: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
            altitude: 16.8
        },
        airSystemSizingSummary: {
            airSystemName: "SYS-1",
            equipmentClass: t(inputs.system.equipmentClass === 'pkg_roof' ? 'eq_class_pkg_roof' : inputs.system.equipmentClass === 'split_dx' ? 'eq_class_split_dx' : 'eq_class_chiller_fcu'),
            airSystemType: t('air_type_szcav'), numberOfZones: 1, location: i.location, calculationMonths: "Jan to Dec",
            sizingData: "Calculated", zoneLssSizing: "Sum of space airflow rates", spaceLssSizing: "Individual peak space loads",
            cooling: {
                totalCoilLoadKW: finalTotalCoilLoadW / 1000,
                sensibleCoilLoadKW: finalSensibleCoilLoadW / 1000,
                coilAirflowLs: supplyAirflowLs, maxBlockLs: supplyAirflowLs, sumOfPeakLs: supplyAirflowLs,
                sensibleHeatRatio: coilSHR,
                sqmPerKw: i.zone.floorArea / (finalTotalCoilLoadW / 1000),
                wattsPerSqm: finalTotalCoilLoadW / i.zone.floorArea,
                loadOccursAt: "Design",
                outdoorAirDB: i.conditions.outdoorDB, outdoorAirWB: i.conditions.outdoorWB,
                enteringDB: mixedAir.dryBulb, enteringWB: 0, // WB calculation is complex, omitting for now
                leavingDB: leavingCoilAir.dryBulb, leavingWB: 0, // WB calculation is complex, omitting for now
                coilADP: T_adp, bypassFactor: bypassFactor, resultingRH: resultingRH, designSupplyTemp: supplyAir.dryBulb,
            },
            heating: {
                maxCoilLoadKW: totalHeatingLoadW / 1000, coilLsAtDesHtg: supplyAirflowLs, maxCoilLs: supplyAirflowLs,
                loadOccursAt: "Des Htg", wattsPerSqm: totalHeatingLoadW / i.zone.floorArea,
                enteringDB: winterMixedAirDB, leavingDB: heatingLeavingDB,
            },
            supplyFan: {
                actualMaxLs: supplyAirflowLs, standardLs: supplyAirflowLs, actualMaxLssqm: supplyAirflowLs / i.zone.floorArea,
                fanMotorBHP: fanPowerBHP, fanMotorKW: fanPowerKW, fanStaticPa: i.system.fanStaticPa,
            },
            ventilation: {
                designAirflowLs: ventilationLs, lsPerSqm: ventilationLs / i.zone.floorArea, lsPerPerson: i.ventilation.lsPerPerson,
            }
        },
        zoneSizingSummary: {
            zoneName: "Zone 1", coolingSensibleKW: totalZoneSensibleW / 1000, designAirflowLs: supplyAirflowLs,
            minAirflowLs: supplyAirflowLs, timeOfPeakLoad: "Design", heatingLoadKW: totalHeatingLoadW / 1000,
            floorArea: i.zone.floorArea, lsPerSqm: supplyAirflowLs / i.zone.floorArea,
        },
        spaceLoadsAndAirflows: {
            spaceName: "Main Space", coolingSensibleKW: totalZoneSensibleW / 1000, timeOfLoad: "Design",
            airflowLs: supplyAirflowLs, heatingLoadKW: totalHeatingLoadW / 1000, floorArea: i.zone.floorArea,
            spaceLsPerSqm: supplyAirflowLs / i.zone.floorArea,
        },
        designLoadSummary: {
            cooling: {
                oa_db_wb: `${i.conditions.outdoorDB} °C / ${i.conditions.outdoorWB} °C`,
                details: {
                    solar: { details: `${i.envelope.windowArea.toFixed(1)} m²`, sensibleW: windowSolarLoad.sensible, latentW: 0 },
                    wall: { details: `${i.envelope.wallArea.toFixed(1)} m²`, sensibleW: wallLoad.sensible, latentW: 0 },
                    roof: { details: `${i.envelope.roofArea.toFixed(1)} m²`, sensibleW: roofLoad.sensible, latentW: 0 },
                    people: { details: String(i.people.count), sensibleW: peopleLoad.sensible, latentW: peopleLoad.latent },
                    lighting: { details: `${i.lighting.loadW} W`, sensibleW: lightingLoad.sensible, latentW: 0 },
                    equipment: { details: `${i.equipment.loadW} W`, sensibleW: equipmentLoad.sensible, latentW: 0 },
                    infiltration: { details: `${i.ventilation.infiltrationACH} ACH`, sensibleW: infiltrationLoad.sensible, latentW: infiltrationLoad.latent },
                    totalZone: { details: "", sensibleW: totalZoneSensibleW, latentW: totalZoneLatentW },
                    ventilation: { details: `${ventilationLs.toFixed(0)} L/s`, sensibleW: ventilationLoad.sensible, latentW: ventilationLoad.latent },
                    totalSystem: { details: "", sensibleW: sensibleCoilLoadW, latentW: latentCoilLoadW },
                }
            },
            heating: {
                oa_db_wb: `${i.conditions.winterOutdoorDB} °C`,
                details: {
                    wall: { details: `${i.envelope.wallArea.toFixed(1)} m²`, sensibleW: heatingWallLoad, latentW: 0 },
                    roof: { details: `${i.envelope.roofArea.toFixed(1)} m²`, sensibleW: heatingRoofLoad, latentW: 0 },
                    solar: { details: `${i.envelope.windowArea.toFixed(1)} m²`, sensibleW: heatingWindowLoad, latentW: 0 },
                    infiltration: { details: `${i.ventilation.infiltrationACH} ACH`, sensibleW: heatingInfiltrationLoad, latentW: 0 },
                    totalZone: { details: "", sensibleW: heatingWallLoad + heatingRoofLoad + heatingWindowLoad + heatingInfiltrationLoad, latentW: 0 },
                    ventilation: { details: `${ventilationLs.toFixed(0)} L/s`, sensibleW: heatingVentilationLoad, latentW: 0 },
                    totalSystem: { details: "", sensibleW: totalHeatingLoadW, latentW: 0 },
                }
            },
            totalConditioning: {
                sensibleW: finalSensibleCoilLoadW, latentW: finalTotalCoilLoadW - finalSensibleCoilLoadW,
                sensibleW_heating: totalHeatingLoadW, latentW_heating: 0
            }
        },
        psychrometrics: {
            coolingDay: "DESIGN COOLING DAY",
            cooling_points: [outdoorAir, mixedAir, leavingCoilAir, supplyAir, indoorAir],
            cooling_table: [],
            cooling_zone_data: { sensibleLoadW: totalZoneSensibleW, thermostatMode: 'Cooling', zoneConditionW: totalZoneSensibleW + totalZoneLatentW, zoneTempC: i.conditions.indoorDB, airflowLs: supplyAirflowLs, co2LevelPpm: 800, terminalHeatingCoilW: 0, zoneHeatingUnitW: 0 },
            heating_table: [],
            heating_zone_data: { sensibleLoadW: totalHeatingLoadW, thermostatMode: 'Heating', zoneConditionW: totalHeatingLoadW, zoneTempC: i.conditions.indoorDB, airflowLs: supplyAirflowLs, co2LevelPpm: 450, terminalHeatingCoilW: 0, zoneHeatingUnitW: 0 },
        },
        legacy: {
            totalLoadTons: finalTotalCoilLoadW / WATT_TO_TON_FACTOR,
            airflowCFM: supplyAirflowLs * LS_TO_CFM,
        }
    };

    newResults.psychrometrics.cooling_table = [
        { component: t('ventilationAir'), location: 'Inlet', dryBulbC: outdoorAir.dryBulb, specificHumidity: outdoorAir.humidityRatio, airflowLs: ventilationLs, co2LevelPpm: 400, sensibleHeatW: ventilationLoad.sensible, latentHeatW: ventilationLoad.latent },
        { component: t('ventReturnMixing'), location: 'Outlet', dryBulbC: mixedAir.dryBulb, specificHumidity: mixedAir.humidityRatio, airflowLs: supplyAirflowLs, co2LevelPpm: 750, sensibleHeatW: 0, latentHeatW: 0 },
        { component: t('centralCoolingCoil'), location: 'Outlet', dryBulbC: leavingCoilAir.dryBulb, specificHumidity: leavingCoilAir.humidityRatio, airflowLs: supplyAirflowLs, co2LevelPpm: 750, sensibleHeatW: -sensibleCoilLoadW, latentHeatW: -latentCoilLoadW },
        { component: t('supplyFan'), location: 'Outlet', dryBulbC: supplyAir.dryBulb, specificHumidity: supplyAir.humidityRatio, airflowLs: supplyAirflowLs, co2LevelPpm: 750, sensibleHeatW: fanPowerW, latentHeatW: 0 },
        { component: t('zoneAir'), location: '', dryBulbC: indoorAir.dryBulb, specificHumidity: indoorAir.humidityRatio, airflowLs: supplyAirflowLs, co2LevelPpm: 800, sensibleHeatW: totalZoneSensibleW, latentHeatW: totalZoneLatentW },
    ];
    setResults(newResults);
    return newResults;
  }, [inputs, t]);

  const handleInputChange = (section: keyof InputState, field: any, value: any) => {
    const processedValue = typeof value === 'number' && isNaN(value) ? '' : value;
    setInputs(prev => {
      const oldValue = prev[section];
      if (typeof oldValue === 'object' && oldValue !== null) {
        return { ...prev, [section]: { ...oldValue, [field]: processedValue }};
      } else {
        return { ...prev, [section]: processedValue };
      }
    });
  };

  const handleSaveClick = () => {
    if (!inputs.projectName) { alert(t("pleaseEnterProjectName")); return; }
    if (results) onSaveProject(inputs, results);
    else {
      const calculatedResults = calculateAll();
      if(calculatedResults) onSaveProject(inputs, calculatedResults);
      else alert(t("cannotSaveBeforeCalc"));
    }
  };

  const handlePrint = () => { window.print(); };

  const handleNext = () => { if (currentStep < 5) setCurrentStep(s => s + 1); };
  const handleBack = () => { if (currentStep > 1) setCurrentStep(s => s - 1); };
  const handleCalculate = () => { calculateAll(); setCurrentStep(5); };
  
  return (
    <div className="bg-gray-900 text-white min-h-screen p-4 sm:p-6 lg:p-8" style={{ fontFamily: 'Cairo, sans-serif' }}>
       <header className="flex justify-between items-center mb-8 print:hidden">
            <div>
                <h1 className="text-4xl sm:text-5xl font-bold text-cyan-400">Emaar HVAC</h1>
                <p className="text-lg text-gray-300 mt-2">{t('headerSubtitle')}</p>
            </div>
             <div className="flex gap-4">
                <LanguageSwitcher />
                <button onClick={() => onNavigate('home')} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded transition-colors">
                    → {t('home')}
                </button>
                 <button onClick={() => onNavigate('projects')} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded transition-colors">
                    → {t('projects')}
                </button>
            </div>
        </header>

      <div className="max-w-7xl mx-auto">
        <div className="mb-12 print:hidden">
            <div className="flex items-start justify-between">
                {STEPS.map((step, index) => (
                    <React.Fragment key={step.number}>
                        <div className="flex flex-col items-center text-center w-28">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${currentStep >= step.number ? 'bg-cyan-500 border-cyan-500' : 'border-gray-600'}`}>
                                {currentStep > step.number ? <CheckCircleIcon className="w-6 h-6 text-white"/> : step.icon }
                            </div>
                            <p className={`mt-2 font-semibold text-xs ${currentStep >= step.number ? 'text-cyan-400' : 'text-gray-500'}`}>{step.title}</p>
                        </div>
                        {index < STEPS.length - 1 && <div className={`flex-1 h-1 mt-6 ${currentStep > index + 1 ? 'bg-cyan-500' : 'bg-gray-600'}`}></div>}
                    </React.Fragment>
                ))}
            </div>
        </div>

        <div className="bg-gray-800 p-6 sm:p-8 rounded-lg min-h-[400px] flex flex-col justify-between print:bg-transparent print:p-0">
            {currentStep === 1 && (
                <div>
                    <h2 className="text-2xl font-bold mb-6 flex items-center"><FolderIcon />{t('calculator_step_title_1')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputGroup label={t('projectName')} type="text" value={inputs.projectName} onChange={e => handleInputChange('projectName', null, e.target.value)} placeholder={placeholderInputs.projectName}/>
                        <InputGroup label={t('preparedBy')} type="text" value={inputs.preparedBy} onChange={e => handleInputChange('preparedBy', null, e.target.value)} placeholder={placeholderInputs.preparedBy}/>
                        <InputGroup label={t('location')} type="text" value={inputs.location} onChange={e => handleInputChange('location', null, e.target.value)} placeholder={placeholderInputs.location}/>
                        <InputGroup label={t('floorArea')} type="number" value={inputs.zone.floorArea} onChange={e => handleInputChange('zone', 'floorArea', parseFloat(e.target.value))} placeholder={String(placeholderInputs.zone.floorArea)} />
                        <InputGroup label={t('ceilingHeight')} type="number" value={inputs.zone.ceilingHeight} onChange={e => handleInputChange('zone', 'ceilingHeight', parseFloat(e.target.value))} placeholder={String(placeholderInputs.zone.ceilingHeight)} />
                        <InputGroup label={t('designAirflowLs')} type="number" value={inputs.system.designAirflowLs} onChange={e => handleInputChange('system', 'designAirflowLs', parseFloat(e.target.value))} placeholder={String(placeholderInputs.system.designAirflowLs)} />
                        <SelectGroup label={t('equipmentClass')} value={inputs.system.equipmentClass} onChange={e => handleInputChange('system', 'equipmentClass', e.target.value)} options={[{value: 'pkg_roof', label: t('eq_class_pkg_roof')}, {value: 'split_dx', label: t('eq_class_split_dx')}, {value: 'chiller_fcu', label: t('eq_class_chiller_fcu')}]}/>
                        <InputGroup label={t('fanStaticPa')} type="number" value={inputs.system.fanStaticPa} onChange={e => handleInputChange('system', 'fanStaticPa', parseFloat(e.target.value))} placeholder={String(placeholderInputs.system.fanStaticPa)} />
                        <InputGroup label={t('fanEfficiency')} type="number" value={inputs.system.fanEfficiency} onChange={e => handleInputChange('system', 'fanEfficiency', parseFloat(e.target.value))} placeholder={String(placeholderInputs.system.fanEfficiency)} />
                    </div>
                </div>
            )}
            {currentStep === 2 && (
                 <div>
                    <h2 className="text-2xl font-bold mb-6 flex items-center"><UsersIcon />{t('calculator_step_title_2')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputGroup label={t('peopleCount')} type="number" value={inputs.people.count} onChange={e => handleInputChange('people', 'count', parseInt(e.target.value, 10))} placeholder={String(placeholderInputs.people.count)} />
                        <SelectGroup label={t('activityLevel')} value={inputs.people.activity} onChange={e => handleInputChange('people', 'activity', e.target.value)} options={[{value: 'sitting', label: t('activity_sitting')}, {value: 'light_work', label: t('activity_light_work')}, {value: 'heavy_work', label: t('activity_heavy_work')}, {value: 'custom_mosque', label: t('activity_custom_mosque')}]}/>
                        <InputGroup label={t('totalLightingPower')} type="number" value={inputs.lighting.loadW} onChange={e => handleInputChange('lighting', 'loadW', parseFloat(e.target.value))} placeholder={String(placeholderInputs.lighting.loadW)} />
                        <InputGroup label={t('totalAppliancePower')} type="number" value={inputs.equipment.loadW} onChange={e => handleInputChange('equipment', 'loadW', parseFloat(e.target.value))} placeholder={String(placeholderInputs.equipment.loadW)} />
                    </div>
                </div>
            )}
             {currentStep === 3 && (
                 <div>
                    <h2 className="text-2xl font-bold mb-6 flex items-center"><BuildingIcon />{t('calculator_step_title_3')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputGroup label={t('windowArea')} type="number" value={inputs.envelope.windowArea} onChange={e => handleInputChange('envelope', 'windowArea', parseFloat(e.target.value))} placeholder={String(placeholderInputs.envelope.windowArea)} />
                        <InputGroup label={t('windowUValue')} type="number" value={inputs.envelope.windowUValue} onChange={e => handleInputChange('envelope', 'windowUValue', parseFloat(e.target.value))} placeholder={String(placeholderInputs.envelope.windowUValue)} />
                        <InputGroup label={t('wallArea')} type="number" value={inputs.envelope.wallArea} onChange={e => handleInputChange('envelope', 'wallArea', parseFloat(e.target.value))} placeholder={String(placeholderInputs.envelope.wallArea)} />
                        <InputGroup label={t('wallUValue')} type="number" value={inputs.envelope.wallUValue} onChange={e => handleInputChange('envelope', 'wallUValue', parseFloat(e.target.value))} placeholder={String(placeholderInputs.envelope.wallUValue)} />
                        <InputGroup label={t('ceilingArea')} type="number" value={inputs.envelope.roofArea} onChange={e => handleInputChange('envelope', 'roofArea', parseFloat(e.target.value))} placeholder={String(placeholderInputs.envelope.roofArea)} />
                        <InputGroup label={t('roofUValue')} type="number" value={inputs.envelope.roofUValue} onChange={e => handleInputChange('envelope', 'roofUValue', parseFloat(e.target.value))} placeholder={String(placeholderInputs.envelope.roofUValue)} />
                        <InputGroup label={t('solarLoadW')} type="number" value={inputs.envelope.solarLoadW} onChange={e => handleInputChange('envelope', 'solarLoadW', parseFloat(e.target.value))} placeholder={String(placeholderInputs.envelope.solarLoadW)} />
                    </div>
                </div>
            )}
            {currentStep === 4 && (
                 <div>
                    <h2 className="text-2xl font-bold mb-6 flex items-center"><ThermometerIcon className="h-6 w-6 ltr:mr-2 rtl:ml-2 text-cyan-400" />{t('calculator_step_title_4')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputGroup label={t('outdoorTemp')} type="number" value={inputs.conditions.outdoorDB} onChange={e => handleInputChange('conditions', 'outdoorDB', parseFloat(e.target.value))} placeholder={String(placeholderInputs.conditions.outdoorDB)} />
                        <InputGroup label={t('outdoorWBT')} type="number" value={inputs.conditions.outdoorWB} onChange={e => handleInputChange('conditions', 'outdoorWB', parseFloat(e.target.value))} placeholder={String(placeholderInputs.conditions.outdoorWB)} />
                        <InputGroup label={t('indoorTemp')} type="number" value={inputs.conditions.indoorDB} onChange={e => handleInputChange('conditions', 'indoorDB', parseFloat(e.target.value))} placeholder={String(placeholderInputs.conditions.indoorDB)} />
                        <InputGroup label={t('indoorRH')} type="number" value={inputs.conditions.indoorRH} onChange={e => handleInputChange('conditions', 'indoorRH', parseFloat(e.target.value))} placeholder={String(placeholderInputs.conditions.indoorRH)} />
                        {/* <InputGroup label={t('designSupplyTemp')} type="number" value={inputs.conditions.designSupplyTemp} onChange={e => handleInputChange('conditions', 'designSupplyTemp', parseFloat(e.target.value))} placeholder={String(placeholderInputs.conditions.designSupplyTemp)} /> */}
                        <InputGroup label={t('winterOutdoorDB')} type="number" value={inputs.conditions.winterOutdoorDB} onChange={e => handleInputChange('conditions', 'winterOutdoorDB', parseFloat(e.target.value))} placeholder={String(placeholderInputs.conditions.winterOutdoorDB)} />
                        <InputGroup label={t('lsPerPerson')} type="number" value={inputs.ventilation.lsPerPerson} onChange={e => handleInputChange('ventilation', 'lsPerPerson', parseFloat(e.target.value))} placeholder={String(placeholderInputs.ventilation.lsPerPerson)} />
                        <InputGroup label={t('infiltrationACH')} type="number" value={inputs.ventilation.infiltrationACH} onChange={e => handleInputChange('ventilation', 'infiltrationACH', parseFloat(e.target.value))} placeholder={String(placeholderInputs.ventilation.infiltrationACH)} />
                        <InputGroup label={t('safetyFactor')} type="number" value={inputs.system.safetyFactor} onChange={e => handleInputChange('system', 'safetyFactor', parseFloat(e.target.value))} placeholder={String(placeholderInputs.system.safetyFactor)} />
                    </div>
                </div>
            )}
            {currentStep === 5 && results && (
                <div>
                    <div className="flex justify-end mb-4 print:hidden">
                        <button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex items-center"><PrintIcon />{t('print')}</button>
                    </div>
                    <FullReport results={results} inputs={inputs}/>
                </div>
            )}

            <div className="mt-8 pt-6 border-t border-gray-700 flex justify-between items-center print:hidden">
                <div>{currentStep > 1 && <button onClick={handleBack} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded transition-colors">{t('back')}</button>}</div>
                <div>
                    {currentStep < 4 && <button onClick={handleNext} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-6 rounded transition-colors">{t('next')}</button>}
                    {currentStep === 4 && <button onClick={handleCalculate} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-lg shadow-lg">{t('calculateNow')}</button>}
                    {currentStep === 5 && <button onClick={handleSaveClick} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded transition-colors">{t('temporarySave')}</button>}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

// Helper Input Components
const InputGroup: React.FC<{label: string; type: string; value: number | string; onChange: (e: any) => void; placeholder?: string;}> = ({ label, type, value, onChange, placeholder }) => (
  <div>
    <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
    <input type={type} value={value} onChange={onChange} min="0" step="any" placeholder={placeholder} className="w-full bg-gray-700 p-2 rounded border border-gray-600 focus:ring-cyan-500 focus:border-cyan-500 placeholder:text-gray-400" />
  </div>
);
const SelectGroup: React.FC<{label: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; options: { value: string; label: string }[];}> = ({ label, value, onChange, options }) => (
  <div>
    <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
    <select value={value} onChange={onChange} className="w-full bg-gray-700 p-2 rounded border border-gray-600 focus:ring-cyan-500 focus:border-cyan-500">
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  </div>
);

// Report Components
const FullReport: React.FC<{results: ResultsState, inputs: InputState}> = ({results, inputs}) => {
    return (
        <div id="print-section" className="bg-gray-800 print:bg-white print:text-black">
            <ReportPage1 r={results} i={inputs} />
            <ReportPage2 r={results} />
            <ReportPage3 r={results} />
            <ReportPage4 r={results} />
            <ReportPage5 r={results} />
            <ReportPage6 r={results} />
        </div>
    );
}

const ReportPageWrapper: React.FC<{r: ResultsState; title: string; pageNum: number; children: React.ReactNode}> = ({r, title, pageNum, children}) => {
    const { t } = useLanguage();
    return (
        <div className="p-4 border border-gray-600 print:border-black font-mono text-xs leading-5 break-after-page print:shadow-none print:border-none">
            <header className="flex justify-between items-start pb-2 border-b-2 border-gray-600 print:border-black">
                <div>
                    <p>{t('projectName')}: {r.projectInfo.projectName}</p>
                    <p>{t('preparedBy')}: {r.projectInfo.preparedBy}</p>
                </div>
                <h2 className="text-base font-bold text-center">{title}</h2>
                <div className="text-right">
                    <p>{r.projectInfo.date}</p>
                    <p>{r.projectInfo.time}</p>
                </div>
            </header>
            <main className="my-4">
                {children}
            </main>
            <footer className="flex justify-between items-center pt-2 border-t border-gray-600 print:border-black text-gray-500 print:text-gray-700">
                <span>Hourly Analysis Program v4.90</span>
                <span>Page {pageNum} of 6</span>
            </footer>
        </div>
    )
};

const ReportRow: React.FC<{label: string; value: string | number; unit?: string; className?: string}> = ({ label, value, unit, className}) => (
    <div className={`flex justify-between items-baseline ${className}`}>
      <span>{label}</span>
      <span className="flex-1 border-b border-dotted border-gray-600 print:border-gray-400 mx-2"></span>
      <span className="text-right min-w-[80px]">{value} {unit}</span>
    </div>
);

const ReportPage1: React.FC<{r: ResultsState, i: InputState}> = ({r, i}) => {
    const { t } = useLanguage();
    const { airSystemSizingSummary: d, projectInfo } = r;
    const getVal = (val: number | '') => val === '' ? 'N/A' : val;
    return (
        <ReportPageWrapper r={r} title={t('report_title_header', {projectName: projectInfo.projectName})} pageNum={1}>
            <section className="mt-4">
                <h3 className="font-bold border-b border-gray-600 print:border-black mb-2">{t('airSystemInfo')}</h3>
                <div className="grid grid-cols-2 gap-x-8">
                   <ReportRow label={t('airSystemName')} value={d.airSystemName} />
                   <ReportRow label={t('numberOfZones')} value={d.numberOfZones} />
                   <ReportRow label={t('equipmentClass')} value={d.equipmentClass} />
                   <ReportRow label={t('floorArea')} value={projectInfo.floorArea.toFixed(1)} unit="m²" />
                   <ReportRow label={t('airSystemType')} value={d.airSystemType} />
                   <ReportRow label={t('location')} value={projectInfo.location} />
                </div>
            </section>
            <section className="mt-4">
                 <h3 className="font-bold border-b border-gray-600 print:border-black mb-2">{t('coolingCoilSizing')}</h3>
                 <div className="grid grid-cols-2 gap-x-8">
                    <div>
                        <ReportRow label={t('totalCoilLoad')} value={d.cooling.totalCoilLoadKW.toFixed(1)} unit="kW" />
                        <ReportRow label={t('sensibleCoilLoad')} value={d.cooling.sensibleCoilLoadKW.toFixed(1)} unit="kW" />
                        <ReportRow label={t('coilLssAtJul')} value={d.cooling.coilAirflowLs.toFixed(0)} unit="L/s" />
                        <ReportRow label={t('sensibleHeatRatio')} value={d.cooling.sensibleHeatRatio.toFixed(3)} />
                        <ReportRow label={t('wattsPerSqm')} value={d.cooling.wattsPerSqm.toFixed(1)} unit="W/m²" />
                    </div>
                    <div>
                        <ReportRow label={t('loadOccursAt')} value={d.cooling.loadOccursAt} />
                        <ReportRow label={t('outdoorTempDBWB')} value={`${d.cooling.outdoorAirDB.toFixed(1)} / ${d.cooling.outdoorAirWB.toFixed(1)}`} unit="°C" />
                        <ReportRow label={t('enteringAirDBWB')} value={`${d.cooling.enteringDB.toFixed(1)} / ${d.cooling.enteringWB.toFixed(1)}`} unit="°C" />
                        <ReportRow label={t('leavingAirDBWB')} value={`${d.cooling.leavingDB.toFixed(1)} / ${d.cooling.leavingWB.toFixed(1)}`} unit="°C" />
                        <ReportRow label={t('coilADP')} value={d.cooling.coilADP.toFixed(1)} unit="°C" />
                        <ReportRow label={t('bypassFactor')} value={d.cooling.bypassFactor.toFixed(3)} />
                    </div>
                 </div>
            </section>
            <section className="mt-4">
                 <h3 className="font-bold border-b border-gray-600 print:border-black mb-2">{t('heatingCoilSizing')}</h3>
                 <div className="grid grid-cols-2 gap-x-8">
                    <div>
                        <ReportRow label={t('maxCoilLoad')} value={d.heating.maxCoilLoadKW.toFixed(1)} unit="kW" />
                        <ReportRow label={t('coilLsAtDesHtg')} value={d.heating.coilLsAtDesHtg.toFixed(0)} unit="L/s" />
                    </div>
                    <div>
                        <ReportRow label={t('loadOccursAt')} value={d.heating.loadOccursAt} />
                        <ReportRow label={t('entDBLvgDB')} value={`${d.heating.enteringDB.toFixed(1)} / ${d.heating.leavingDB.toFixed(1)}`} unit="°C" />
                    </div>
                 </div>
            </section>
             <section className="mt-4">
                 <h3 className="font-bold border-b border-gray-600 print:border-black mb-2">{t('supplyFanSizing')}</h3>
                 <div className="grid grid-cols-2 gap-x-8">
                    <div>
                        <ReportRow label={t('actualMaxLs')} value={d.supplyFan.actualMaxLs.toFixed(0)} unit="L/s" />
                        <ReportRow label={t('actualMaxLssqm')} value={d.supplyFan.actualMaxLssqm.toFixed(2)} unit="L/(s-m²)" />
                    </div>
                    <div>
                        <ReportRow label={t('fanMotorBHP')} value={d.supplyFan.fanMotorBHP.toFixed(2)} unit="BHP" />
                        <ReportRow label={t('fanMotorKW')} value={d.supplyFan.fanMotorKW.toFixed(2)} unit="kW" />
                        <ReportRow label={t('fanStatic')} value={d.supplyFan.fanStaticPa.toFixed(0)} unit="Pa" />
                    </div>
                 </div>
            </section>
            <section className="mt-4">
                <h3 className="font-bold border-b border-gray-600 print:border-black mb-2">{t('environmentalSummary')}</h3>
                <div className="grid grid-cols-2 gap-x-8">
                    <ReportRow label={t('outdoorTemp')} value={getVal(i.conditions.outdoorDB)} unit="°C"/>
                    <ReportRow label={t('outdoorWBT')} value={getVal(i.conditions.outdoorWB)} unit="°C"/>
                    <ReportRow label={t('indoorTemp')} value={getVal(i.conditions.indoorDB)} unit="°C"/>
                    <ReportRow label={t('indoorRH')} value={getVal(i.conditions.indoorRH)} unit="%"/>
                    <ReportRow label={t('designSupplyTemp')} value={r.airSystemSizingSummary.cooling.designSupplyTemp.toFixed(1)} unit="°C"/>
                    <ReportRow label={t('winterOutdoorDB')} value={getVal(i.conditions.winterOutdoorDB)} unit="°C"/>
                    <ReportRow label={t('safetyFactor')} value={getVal(i.system.safetyFactor)} unit="%"/>
                </div>
            </section>
        </ReportPageWrapper>
    );
}

const ReportPage2: React.FC<{r: ResultsState}> = ({r}) => {
    const { t } = useLanguage();
    const { airSystemSizingSummary: d, zoneSizingSummary: z, spaceLoadsAndAirflows: s, projectInfo } = r;
    return (
        <ReportPageWrapper r={r} title={t('report_title_zone', {projectName: projectInfo.projectName})} pageNum={2}>
             <section className="mt-4">
                <h3 className="font-bold border-b border-gray-600 print:border-black mb-2">{t('airSystemInfo')}</h3>
                <div className="grid grid-cols-2 gap-x-8">
                   <ReportRow label={t('airSystemName')} value={d.airSystemName} />
                   <ReportRow label={t('numberOfZones')} value={d.numberOfZones} />
                   <ReportRow label={t('equipmentClass')} value={d.equipmentClass} />
                   <ReportRow label={t('floorArea')} value={projectInfo.floorArea.toFixed(1)} unit="m²" />
                   <ReportRow label={t('airSystemType')} value={d.airSystemType} />
                   <ReportRow label={t('location')} value={projectInfo.location} />
                </div>
            </section>
            <section className="mt-4">
                <h3 className="font-bold border-b border-gray-600 print:border-black mb-2">{t('sizingCalcInfo')}</h3>
                <div className="grid grid-cols-2 gap-x-8">
                   <ReportRow label={t('calculationMonths')} value={d.calculationMonths} />
                   <ReportRow label={t('zoneLssSizing')} value={d.zoneLssSizing} />
                   <ReportRow label={t('sizingData')} value={d.sizingData} />
                   <ReportRow label={t('spaceLssSizing')} value={d.spaceLssSizing} />
                </div>
            </section>
            <section className="mt-4">
                <h3 className="font-bold border-b border-gray-600 print:border-black mb-2">{t('zoneSizingData')}</h3>
                 <table className="w-full text-left table-auto">
                    <thead>
                        {/* FIX: Use renamed translation key 'designAirflowLs_zone' to match change in translations.ts */}
                        <tr className="text-gray-400 print:text-gray-600 text-[10px]"><th className="w-1/6">{t('zoneName')}</th><th>{t('maxCoolingSensibleKW')}</th><th>{t('designAirflowLs_zone')}</th><th>{t('minAirflowLs')}</th><th>{t('timeOfPeak')}</th><th>{t('maxHeatingLoadKW')}</th><th>{t('areaM2')}</th><th>{t('zoneLssqm')}</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>{z.zoneName}</td><td>{z.coolingSensibleKW.toFixed(1)}</td><td>{z.designAirflowLs.toFixed(0)}</td><td>{z.minAirflowLs.toFixed(0)}</td><td>{z.timeOfPeakLoad}</td><td>{z.heatingLoadKW.toFixed(1)}</td><td>{z.floorArea.toFixed(1)}</td><td>{z.lsPerSqm.toFixed(2)}</td></tr>
                    </tbody>
                </table>
            </section>
            <section className="mt-4">
                <h3 className="font-bold border-b border-gray-600 print:border-black mb-2">{t('zoneTerminalSizing')}</h3>
                <p className="italic text-gray-500">{t('noZoneTerminalData')}</p>
            </section>
            <section className="mt-4">
                <h3 className="font-bold border-b border-gray-600 print:border-black mb-2">{t('spaceLoadsAndAirflows')}</h3>
                 <table className="w-full text-left table-auto">
                    <thead><tr className="text-gray-400 print:text-gray-600 text-[10px]"><th>{t('zoneNameSpaceName')}</th><th>Mult.</th><th>{t('coolingSensibleKW')}</th><th>{t('timeOfLoad')}</th><th>{t('airflowLs')}</th><th>{t('heatingLoadKW')}</th><th>{t('areaM2')}</th><th>{t('spaceLssqm')}</th></tr></thead>
                    <tbody>
                        <tr><td><strong>{z.zoneName}</strong></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
                        <tr><td className="pl-4">{s.spaceName}</td><td>1</td><td>{s.coolingSensibleKW.toFixed(1)}</td><td>{s.timeOfLoad}</td><td>{s.airflowLs.toFixed(0)}</td><td>{s.heatingLoadKW.toFixed(1)}</td><td>{s.floorArea.toFixed(1)}</td><td>{s.spaceLsPerSqm.toFixed(2)}</td></tr>
                    </tbody>
                </table>
            </section>
        </ReportPageWrapper>
    );
};

const ReportPage3: React.FC<{r: ResultsState}> = ({r}) => {
    const { t } = useLanguage();
    const { designLoadSummary: d, projectInfo } = r;
    const coolingOrder = ['solar', 'wall', 'roof', 'people', 'lighting', 'equipment', 'infiltration', 'totalZone', 'ventilation', 'totalSystem'];
    const heatingOrder = ['solar', 'wall', 'roof', 'infiltration', 'totalZone', 'ventilation', 'totalSystem'];
    
    return (
        <ReportPageWrapper r={r} title={t('report_title_design_load', {projectName: projectInfo.projectName})} pageNum={3}>
            <div className="grid grid-cols-2 gap-x-4">
                <div className="font-bold text-center">{t('designCooling')}</div>
                <div className="font-bold text-center">{t('designHeating')}</div>
                <div className="text-center text-xs">{t('coolingDataAt')} {d.cooling.oa_db_wb}</div>
                <div className="text-center text-xs">{t('heatingDataAt')} {d.heating.oa_db_wb}</div>
            </div>
            <table className="w-full mt-2">
                <thead>
                    <tr className="text-[10px] text-gray-400 print:text-gray-600">
                        <th className="w-1/4 text-left">{t('zoneLoads')}</th>
                        <th className="w-1/12 text-left">{t('details')}</th>
                        <th className="w-1/12 text-right">{t('sensibleW')}</th>
                        <th className="w-1/12 text-right">{t('latentW')}</th>
                        <th className="w-1/12"></th>
                        <th className="w-1/4 text-left">{t('details')}</th>
                        <th className="w-1/12 text-right">{t('sensibleW')}</th>
                        <th className="w-1/12 text-right">{t('latentW')}</th>
                    </tr>
                </thead>
                <tbody>
                    {coolingOrder.map((key, i) => {
                        const cKey = coolingOrder[i];
                        const hKey = heatingOrder[i];
                        const cData = d.cooling.details[cKey];
                        const hData = d.heating.details[hKey];
                        const isTotal = cKey.includes('total');
                        const rowClass = isTotal ? "font-bold border-t border-gray-600" : "";
                        return (
                            <tr key={cKey} className={rowClass}>
                                <td className="text-left">{t(`load_${cKey}`)}</td>
                                <td className="text-left">{cData?.details || ''}</td>
                                <td className="text-right">{cData ? cData.sensibleW.toFixed(0) : '-'}</td>
                                <td className="text-right">{cData ? cData.latentW.toFixed(0) : '-'}</td>
                                <td className="w-1/12"></td>
                                { hKey && hData ?
                                <>
                                <td className="text-left">{hData.details || ''}</td>
                                <td className="text-right">{hData.sensibleW.toFixed(0)}</td>
                                <td className="text-right">{hData.latentW.toFixed(0)}</td>
                                </>
                                : <><td></td><td></td><td></td></>
                                }
                            </tr>
                        )
                    })}
                     <tr className="font-bold border-t-2 border-b-2 border-gray-400 print:border-black my-2 py-1">
                        <td>{t('totalConditioning')}</td><td></td>
                        <td className="text-right">{r.designLoadSummary.totalConditioning.sensibleW.toFixed(0)}</td>
                        <td className="text-right">{r.designLoadSummary.totalConditioning.latentW.toFixed(0)}</td>
                        <td></td><td></td>
                        <td className="text-right">{r.designLoadSummary.totalConditioning.sensibleW_heating.toFixed(0)}</td>
                        <td className="text-right">{r.designLoadSummary.totalConditioning.latentW_heating.toFixed(0)}</td>
                    </tr>
                </tbody>
            </table>
        </ReportPageWrapper>
    );
};

const PsychrometricTable: React.FC<{title: string, tableData: PsychrometricTableRow[], zoneData: PsychrometricZoneData}> = ({title, tableData, zoneData}) => {
    const { t } = useLanguage();
    if (tableData.length === 0) return <div className="mt-4"><h3 className="font-bold text-center mb-2">{title}</h3><p className="italic text-gray-500">Psychrometric table data not available.</p></div>
    return (
        <div className="mt-4">
            <h3 className="font-bold text-center mb-2">{title}</h3>
            <h4 className="font-bold mb-1">TABLE 1: SYSTEM DATA</h4>
            <table className="w-full text-left table-auto">
                <thead><tr className="text-gray-400 print:text-gray-600 text-[10px]"><th className="w-1/4">{t('component')}</th><th>{t('location')}</th><th>{t('dryBulbTempC')}</th><th>{t('specificHumidity')}</th><th>{t('airflowLs')}</th><th>{t('co2Level')}</th><th>{t('sensibleHeatW')}</th><th>{t('latentHeatW')}</th></tr></thead>
                <tbody>{tableData.map(row => <tr key={row.component}><td>{row.component}</td><td>{row.location}</td><td>{row.dryBulbC.toFixed(1)}</td><td>{row.specificHumidity.toFixed(5)}</td><td>{row.airflowLs.toFixed(0)}</td><td>{row.co2LevelPpm}</td><td>{row.sensibleHeatW.toFixed(0)}</td><td>{row.latentHeatW.toFixed(0)}</td></tr>)}</tbody>
            </table>
             <p className="text-xs italic mt-2 text-gray-500">{t('psychro_note', {alt: '16.8'})}</p>
            <h4 className="font-bold mb-1 mt-4">TABLE 2: ZONE DATA</h4>
            <table className="w-full text-left table-auto">
                <thead><tr className="text-gray-400 print:text-gray-600 text-[10px]"><th>{t('zoneName')}</th><th>{t('zoneSensibleLoadW')}</th><th>{t('tstatMode')}</th><th>{t('zoneCondW')}</th><th>{t('zoneTempC')}</th><th>{t('airflowLs')}</th><th>{t('co2Level')}</th><th>{t('terminalHeatingCoilW')}</th><th>{t('zoneHeatingUnitW')}</th></tr></thead>
                <tbody><tr><td>Zone 1</td><td>{zoneData.sensibleLoadW.toFixed(0)}</td><td>{zoneData.thermostatMode}</td><td>{zoneData.zoneConditionW.toFixed(0)}</td><td>{zoneData.zoneTempC.toFixed(1)}</td><td>{zoneData.airflowLs.toFixed(0)}</td><td>{zoneData.co2LevelPpm}</td><td>{zoneData.terminalHeatingCoilW.toFixed(0)}</td><td>{zoneData.zoneHeatingUnitW.toFixed(0)}</td></tr></tbody>
            </table>
        </div>
    );
};

const ReportPage4: React.FC<{r: ResultsState}> = ({r}) => {
    const { t } = useLanguage();
    return <ReportPageWrapper r={r} title={t('report_title_psychro', {projectName: r.projectInfo.projectName})} pageNum={4}>
        <PsychrometricTable title={r.psychrometrics.coolingDay} tableData={r.psychrometrics.cooling_table} zoneData={r.psychrometrics.cooling_zone_data} />
    </ReportPageWrapper>;
}
const ReportPage5: React.FC<{r: ResultsState}> = ({r}) => {
    const { t } = useLanguage();
    return <ReportPageWrapper r={r} title={t('report_title_psychro', {projectName: r.projectInfo.projectName})} pageNum={5}>
        <PsychrometricTable title={t('winterDesignHeating')} tableData={r.psychrometrics.heating_table} zoneData={r.psychrometrics.heating_zone_data} />
    </ReportPageWrapper>;
}
const ReportPage6: React.FC<{r: ResultsState}> = ({r}) => {
    const { t } = useLanguage();
    const { cooling_points, coolingDay } = r.psychrometrics;
    if(cooling_points.length < 5) return <ReportPageWrapper r={r} title={t('report_title_psychro_analysis', {projectName: r.projectInfo.projectName})} pageNum={6}><p>Not enough data for chart.</p></ReportPageWrapper>;

    // SVG Chart dimensions and scales
    const width = 500, height = 300;
    const allTemps = cooling_points.map(p => p.dryBulb);
    const allHums = cooling_points.map(p => p.humidityRatio);
    const tempMin = Math.floor(Math.min(...allTemps) / 5) * 5 - 5;
    const tempMax = Math.ceil(Math.max(...allTemps) / 5) * 5 + 5;
    const humMin = Math.min(...allHums) - 0.002;
    const humMax = Math.max(...allHums) + 0.002;


    const tempToX = (temp: number) => (temp - tempMin) / (tempMax - tempMin) * width;
    const humToY = (hum: number) => height - ((hum - humMin) / (humMax - humMin) * height);
    
    const points = [
        { x: tempToX(cooling_points[0].dryBulb), y: humToY(cooling_points[0].humidityRatio), label: '1' }, // Outdoor
        { x: tempToX(cooling_points[1].dryBulb), y: humToY(cooling_points[1].humidityRatio), label: '2' }, // Mixed
        { x: tempToX(cooling_points[2].dryBulb), y: humToY(cooling_points[2].humidityRatio), label: '3' }, // Coil Outlet
        { x: tempToX(cooling_points[3].dryBulb), y: humToY(cooling_points[3].humidityRatio), label: '4' }, // Fan Outlet
        { x: tempToX(cooling_points[4].dryBulb), y: humToY(cooling_points[4].humidityRatio), label: '5' }, // Room
    ];

    const linePath = `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y} L ${points[2].x} ${points[2].y}`;
    const roomLinePath = `M ${points[3].x} ${points[3].y} L ${points[4].x} ${points[4].y}`;

    return (
        <ReportPageWrapper r={r} title={t('report_title_psychro_analysis', {projectName: r.projectInfo.projectName})} pageNum={6}>
            <div className="text-center">
                <p>{t('location')}: {r.projectInfo.location}</p>
                <p>{t('altitude')}: {r.projectInfo.altitude} m.</p>
                <p>{t('dataFor')}: {coolingDay}</p>
            </div>
            <div className="flex mt-4">
                <div className="text-xs flex flex-col justify-center space-y-1">
                    <span>1. {t('outdoorAir')}</span><span>2. {t('mixedAir')}</span><span>3. {t('centralCoolingCoilOutlet')}</span><span>4. {t('supplyFanOutlet')}</span><span>5. {t('roomAir')}</span>
                </div>
                <div className="relative ml-4">
                    <svg width={width + 50} height={height + 50} viewBox="-20 -20 570 340" className="bg-gray-700 print:bg-white border border-gray-500">
                        {/* Y-axis */}
                        <g className="text-[8px] fill-current text-gray-400 print:text-black">
                            {Array.from({length: 11}).map((_, i) => {
                                const hum = humMin + (humMax-humMin) / 10 * i;
                                const y = humToY(hum);
                                return <React.Fragment key={i}><text x={width + 5} y={y + 3}>{hum.toFixed(4)}</text><line x1="0" y1={y} x2={width} y2={y} stroke="currentColor" strokeWidth="0.5" strokeDasharray="2,2"/></React.Fragment>
                            })}
                             <text transform={`translate(${width + 45}, ${height/2}) rotate(-90)`} textAnchor="middle">{t('specificHumidityKgKg')}</text>
                        </g>
                        {/* X-axis */}
                        <g className="text-[8px] fill-current text-gray-400 print:text-black">
                            {Array.from({length: 10}).map((_, i) => {
                                const temp = tempMin + (tempMax - tempMin) / 9 * i;
                                const x = tempToX(temp);
                                return <React.Fragment key={i}><text x={x-5} y={height + 15}>{Math.round(temp)}</text><line x1={x} y1="0" x2={x} y2={height} stroke="currentColor" strokeWidth="0.5" strokeDasharray="2,2"/></React.Fragment>
                            })}
                            <text x={width/2 - 20} y={height + 30}>{t('temperatureC')}</text>
                        </g>
                        {/* Saturation Curve (Approximation) */}
                        <path d={
                            Array.from({length: 20}).map((_,i) => {
                                const temp = tempMin + (tempMax-tempMin)/19 * i;
                                const hum = getHumidityRatioFromRH(temp, 100);
                                return `${i===0?'M':'L'} ${tempToX(temp)} ${humToY(hum)}`
                            }).join(' ')
                        } stroke="orange" fill="none" strokeWidth="1.5" />
                         {/* Process lines */}
                        <path d={linePath} stroke="blue" fill="none" strokeWidth="1.5" />
                        <path d={roomLinePath} stroke="pink" fill="none" strokeWidth="1.5" />
                        {/* Data Points */}
                        {points.map(p => <g key={p.label}><circle cx={p.x} cy={p.y} r="3" fill="red" /><text x={p.x + 5} y={p.y - 5} className="text-[10px] font-bold fill-current">{p.label}</text></g>)}
                    </svg>
                </div>
            </div>
        </ReportPageWrapper>
    );
}

export default CalculatorPage;