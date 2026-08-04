import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { InputState, ResultsState, Project, PsychrometricPoint, PsychrometricTableRow, PsychrometricZoneData, DuctSizingResult, MaterialQuantitiesResult } from './types';
import { useLanguage } from './LanguageContext';
import { 
  HEAT_GAIN_PERSON_SENSIBLE_LATENT_WATT, WATT_TO_TON_FACTOR,
  LS_TO_CFM, STANDARD_ATM_PASCALS, 
  SPECIFIC_HEAT_AIR_J_KG_K, LATENT_HEAT_VAPORIZATION_J_KG, AIR_DENSITY_KG_M3
} from './constants';
import { BuildingIcon, UsersIcon, LightbulbIcon, DocumentReportIcon, FolderIcon, PrintIcon, CheckCircleIcon, ThermometerIcon, DownloadIcon, RulerIcon, CalculatorIcon, WindIcon } from './Icons';

declare global {
  interface Window {
    html2pdf: any;
  }
}

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

const getWBFromDBandW = (T_db: number, W: number): number => {
    if (W < 0) return T_db;
    let iterations = 0;
    const maxIterations = 100;
    let high = T_db;
    let low = -50;
    let T_wb = (high + low) / 2;

    while (iterations < maxIterations) {
        const W_calc = getHumidityRatioFromWB(T_db, T_wb);
        if (Math.abs(W_calc - W) < 1e-6) {
            return T_wb;
        }
        if (W_calc > W) {
            high = T_wb;
        } else {
            low = T_wb;
        }
        T_wb = (high + low) / 2;
        iterations++;
    }
    return T_wb;
};

const getEnthalpy = (T_db: number, W: number): number => {
    return (1.006 * T_db + W * (2501 + 1.86 * T_db));
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
  zone: { roomLength: '', roomWidth: '', floorArea: 2055, ceilingHeight: 4 },
  people: { count: 600, activity: 'custom_mosque' },
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
    indoorDB: 24.4, indoorRH: 64,
    designSupplyTemp: 14.4,
    winterOutdoorDB: 7.2,
  },
};

const emptyInputs: InputState = {
    projectName: '',
    preparedBy: '',
    location: '',
    system: { equipmentClass: 'pkg_roof', airSystemType: 'szcav', fanStaticPa: '', fanEfficiency: '', safetyFactor: '', designAirflowLs: '' },
    zone: { roomLength: '', roomWidth: '', floorArea: '', ceilingHeight: '' },
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
    <button onClick={toggleLanguage} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded transition-colors text-sm">
      {language === 'ar' ? 'English' : 'العربية'}
    </button>
  );
};

const CalculatorPage: React.FC<CalculatorPageProps> = ({ onNavigate, onSaveProject, activeProject }) => {
  const [inputs, setInputs] = useState<InputState>(emptyInputs);
  const [results, setResults] = useState<ResultsState | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
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

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

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
            fanEfficiency: getNum(inputs.system.fanEfficiency, 65),
            safetyFactor: getNumCanBeZero(inputs.system.safetyFactor),
            designAirflowLs: getNumCanBeZero(inputs.system.designAirflowLs)
        },
        zone: {
            floorArea: getNum(inputs.zone.floorArea, 1),
            ceilingHeight: getNum(inputs.zone.ceilingHeight, 3),
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
            designSupplyTemp: getNum(inputs.conditions.designSupplyTemp, 14.4),
            winterOutdoorDB: getNum(inputs.conditions.winterOutdoorDB, 5),
        },
    };
    
    // --- LOAD CALCULATIONS (COOLING) ---
    const peopleGains = HEAT_GAIN_PERSON_SENSIBLE_LATENT_WATT[i.people.activity] || HEAT_GAIN_PERSON_SENSIBLE_LATENT_WATT['light_work'];
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
    const humidityDiff = Math.max(0, outdoorAirW - indoorAirW);
    
    const zoneVolume = i.zone.floorArea * i.zone.ceilingHeight;
    const infiltrationMassFlow = (i.ventilation.infiltrationACH * zoneVolume / 3600) * AIR_DENSITY_KG_M3;
    const infiltrationLoad = {
        sensible: infiltrationMassFlow * SPECIFIC_HEAT_AIR_J_KG_K * tempDiff,
        latent: infiltrationMassFlow * LATENT_HEAT_VAPORIZATION_J_KG * humidityDiff
    };
    
    const ventilationLs = i.ventilation.lsPerPerson * i.people.count;

    const totalZoneSensibleW = [peopleLoad, lightingLoad, equipmentLoad, wallLoad, roofLoad, windowConductiveLoad, windowSolarLoad, infiltrationLoad].reduce((sum, load) => sum + load.sensible, 0);
    const totalZoneLatentW = [peopleLoad, infiltrationLoad].reduce((sum, load) => sum + load.latent, 0);
    
    // Automatic supply airflow calculation if not provided by user
    let supplyAirflowLs = i.system.designAirflowLs;
    if (supplyAirflowLs <= 0) {
      const deltaT = Math.max(4, i.conditions.indoorDB - i.conditions.designSupplyTemp);
      const reqMassFlow = totalZoneSensibleW / (SPECIFIC_HEAT_AIR_J_KG_K * deltaT);
      supplyAirflowLs = Math.round((reqMassFlow / AIR_DENSITY_KG_M3) * 1000);
      if (supplyAirflowLs <= 0) supplyAirflowLs = 300;
    }
    const supplyMassFlow = (supplyAirflowLs / 1000) * AIR_DENSITY_KG_M3;

    // --- FAN CALCULATIONS ---
    const supplyAirflowM3s = supplyAirflowLs / 1000;
    const fanEfficiencyDecimal = i.system.fanEfficiency / 100;
    const fanPowerW = (fanEfficiencyDecimal > 0 && i.system.fanStaticPa > 0) ? (supplyAirflowM3s * i.system.fanStaticPa) / fanEfficiencyDecimal : 0;
    const fanPowerKW = fanPowerW / 1000;
    const fanPowerBHP = fanPowerKW * 1.341;
    
    // --- PSYCHROMETRIC CALCULATIONS ---
    const outdoorAir = getPsychrometrics("Outdoor Air", i.conditions.outdoorDB, outdoorAirW);
    const indoorAir = getPsychrometrics("Room Air", i.conditions.indoorDB, indoorAirW);
    
    const fanHeatDeltaT = (supplyMassFlow > 0) ? fanPowerW / (supplyMassFlow * SPECIFIC_HEAT_AIR_J_KG_K) : 0;
    const T_supply_entering_zone_calc = i.conditions.indoorDB - (totalZoneSensibleW / (supplyMassFlow * SPECIFIC_HEAT_AIR_J_KG_K));
    const W_supply_entering_zone_calc = indoorAirW - (totalZoneLatentW / (supplyMassFlow * LATENT_HEAT_VAPORIZATION_J_KG));
    const T_leaving_coil_calc = T_supply_entering_zone_calc - fanHeatDeltaT;
    const W_leaving_coil_calc = W_supply_entering_zone_calc;
    const returnAirflowLs = Math.max(0, supplyAirflowLs - ventilationLs);
    const mixedAirDB_calc = (returnAirflowLs * indoorAir.dryBulb + ventilationLs * outdoorAir.dryBulb) / supplyAirflowLs;
    const mixedAirW_calc = (returnAirflowLs * indoorAir.humidityRatio + ventilationLs * outdoorAir.humidityRatio) / supplyAirflowLs;

    const mixedAir = getPsychrometrics("Mixed Air", mixedAirDB_calc, mixedAirW_calc);
    const leavingCoilAir = getPsychrometrics("Central Cooling Coil Outlet", T_leaving_coil_calc, W_leaving_coil_calc);
    const supplyAir = getPsychrometrics("Supply Fan Outlet", T_supply_entering_zone_calc, W_supply_entering_zone_calc);
    
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
        if (Math.abs(mixedAir.humidityRatio - leavingCoilAir.humidityRatio) < 1e-9) break;
        T_adp = mixedAir.dryBulb - ((mixedAir.dryBulb - leavingCoilAir.dryBulb) * (mixedAir.humidityRatio - W_adp)) / (mixedAir.humidityRatio - leavingCoilAir.humidityRatio);
    }
    const bypassFactor = (Math.abs(mixedAir.dryBulb - T_adp) > 1e-6) ? (leavingCoilAir.dryBulb - T_adp) / (mixedAir.dryBulb - T_adp) : 0;

    const Pws_leaving = getSatVaporPressure(supplyAir.dryBulb);
    const Pw_leaving = (supplyAir.humidityRatio * STANDARD_ATM_PASCALS) / (0.621945 + supplyAir.humidityRatio);
    const resultingRH = (Pw_leaving / Pws_leaving) * 100;
    
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

    // --- DUCT SIZING & MATERIAL CALCULATIONS ---
    const airflowCFM = Math.round(supplyAirflowLs * LS_TO_CFM);
    const velocityFPM = 900;
    const velocityMs = velocityFPM * 0.00508;
    const areaSqFt = airflowCFM / velocityFPM;
    const areaSqM = areaSqFt * 0.092903;
    const circularDiameterInches = Math.round(Math.sqrt(areaSqFt / (Math.PI / 4)) * 12 * 10) / 10;
    const circularDiameterCm = Math.round(circularDiameterInches * 2.54 * 10) / 10;
    const rectangularHeightInches = Math.max(6, Math.round(Math.sqrt(areaSqFt / 1.5) * 12));
    const rectangularWidthInches = Math.max(6, Math.round(rectangularHeightInches * 1.5));
    const rectangularWidthCm = Math.round(rectangularWidthInches * 2.54);
    const rectangularHeightCm = Math.round(rectangularHeightInches * 2.54);

    const ductLengthMeters = 10;
    const perimeterMeters = ((rectangularWidthCm + rectangularHeightCm) * 2) / 100;
    const sheetMetalSqM = Number((perimeterMeters * ductLengthMeters * 1.15).toFixed(1));
    const insulationSqM = Number((perimeterMeters * ductLengthMeters * 1.10).toFixed(1));
    const flangesPcs = Math.ceil(ductLengthMeters / 1.2);
    const screwsPcs = flangesPcs * 20;
    const hangersPcs = Math.ceil(ductLengthMeters / 1.5);

    const ductResult: DuctSizingResult = {
      airflowCFM,
      airflowLs: supplyAirflowLs,
      velocityFPM,
      velocityMs,
      areaSqFt,
      areaSqM,
      circularDiameterInches,
      circularDiameterCm,
      rectangularWidthInches,
      rectangularWidthCm,
      rectangularHeightInches,
      rectangularHeightCm,
      aspectRatio: '1:1.5'
    };

    const materialsResult: MaterialQuantitiesResult = {
      ductLengthMeters,
      perimeterMeters,
      sheetMetalSqM,
      insulationSqM,
      flangesPcs,
      screwsPcs,
      hangersPcs
    };
    
    // --- FINAL RESULTS ASSEMBLY ---
    const newResults: ResultsState = {
        projectInfo: {
            projectName: i.projectName, preparedBy: i.preparedBy, location: i.location,
            floorArea: i.zone.floorArea,
            date: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            altitude: 16.8,
        },
        ductAndMaterials: {
          duct: ductResult,
          materials: materialsResult
        },
        airSystemSizingSummary: {
            airSystemName: i.projectName + " System", equipmentClass: i.system.equipmentClass.toUpperCase(), airSystemType: i.system.airSystemType.toUpperCase(),
            numberOfZones: 1, location: i.location, calculationMonths: "Jan to Dec", sizingData: "Calculated", zoneLssSizing: "Sum of peak zone L/s", spaceLssSizing: "Peak space L/s",
            cooling: {
                totalCoilLoadKW: finalTotalCoilLoadW / 1000,
                sensibleCoilLoadKW: finalSensibleCoilLoadW / 1000,
                coilAirflowLs: supplyAirflowLs,
                maxBlockLs: supplyAirflowLs,
                sumOfPeakLs: supplyAirflowLs,
                sensibleHeatRatio: coilSHR,
                sqmPerKw: (finalTotalCoilLoadW > 0) ? i.zone.floorArea / (finalTotalCoilLoadW / 1000) : 0,
                wattsPerSqm: (i.zone.floorArea > 0) ? finalTotalCoilLoadW / i.zone.floorArea : 0,
                loadOccursAt: "Jul 1600",
                outdoorAirDB: i.conditions.outdoorDB, outdoorAirWB: i.conditions.outdoorWB,
                enteringDB: mixedAir.dryBulb, enteringWB: getWBFromDBandW(mixedAir.dryBulb, mixedAir.humidityRatio),
                leavingDB: leavingCoilAir.dryBulb, leavingWB: getWBFromDBandW(leavingCoilAir.dryBulb, leavingCoilAir.humidityRatio),
                coilADP: T_adp,
                bypassFactor: bypassFactor,
                resultingRH: resultingRH,
                designSupplyTemp: T_supply_entering_zone_calc,
            },
            heating: {
                maxCoilLoadKW: totalHeatingLoadW / 1000,
                coilLsAtDesHtg: supplyAirflowLs,
                maxCoilLs: supplyAirflowLs,
                loadOccursAt: "Des Htg",
                wattsPerSqm: (i.zone.floorArea > 0) ? totalHeatingLoadW / i.zone.floorArea : 0,
                enteringDB: winterMixedAirDB,
                leavingDB: heatingLeavingDB,
            },
            supplyFan: {
                actualMaxLs: supplyAirflowLs, standardLs: supplyAirflowLs, actualMaxLssqm: (i.zone.floorArea > 0) ? supplyAirflowLs / i.zone.floorArea : 0,
                fanMotorBHP: fanPowerBHP, fanMotorKW: fanPowerKW, fanStaticPa: i.system.fanStaticPa
            },
            ventilation: {
                designAirflowLs: ventilationLs, lsPerSqm: (i.zone.floorArea > 0) ? ventilationLs / i.zone.floorArea : 0, lsPerPerson: i.ventilation.lsPerPerson
            }
        },
        zoneSizingSummary: {
            zoneName: "Zone 1", coolingSensibleKW: totalZoneSensibleW / 1000, designAirflowLs: supplyAirflowLs, minAirflowLs: supplyAirflowLs, timeOfPeakLoad: "Jul 1600", heatingLoadKW: totalHeatingLoadW / 1000, floorArea: i.zone.floorArea, lsPerSqm: (i.zone.floorArea > 0) ? supplyAirflowLs / i.zone.floorArea : 0
        },
        spaceLoadsAndAirflows: {
            spaceName: "Space 1", coolingSensibleKW: totalZoneSensibleW / 1000, timeOfLoad: "Jul 1600", airflowLs: supplyAirflowLs, heatingLoadKW: totalHeatingLoadW / 1000, floorArea: i.zone.floorArea, spaceLsPerSqm: (i.zone.floorArea > 0) ? supplyAirflowLs / i.zone.floorArea : 0
        },
        designLoadSummary: {
            cooling: {
                oa_db_wb: `${i.conditions.outdoorDB.toFixed(1)} / ${i.conditions.outdoorWB.toFixed(1)} °C`,
                details: {
                    solar: { details: `${i.envelope.windowArea.toFixed(1)} m²`, sensibleW: windowSolarLoad.sensible, latentW: 0 },
                    wall: { details: `${i.envelope.wallArea.toFixed(1)} m²`, sensibleW: wallLoad.sensible, latentW: 0 },
                    roof: { details: `${i.envelope.roofArea.toFixed(1)} m²`, sensibleW: roofLoad.sensible, latentW: 0 },
                    people: { details: `${i.people.count}`, sensibleW: peopleLoad.sensible, latentW: peopleLoad.latent },
                    lighting: { details: `${(i.lighting.loadW/1000).toFixed(1)} kW`, sensibleW: lightingLoad.sensible, latentW: 0 },
                    equipment: { details: `${(i.equipment.loadW/1000).toFixed(1)} kW`, sensibleW: equipmentLoad.sensible, latentW: 0 },
                    infiltration: { details: `${i.ventilation.infiltrationACH.toFixed(1)} ACH`, sensibleW: infiltrationLoad.sensible, latentW: infiltrationLoad.latent },
                    totalZone: { details: '', sensibleW: totalZoneSensibleW, latentW: totalZoneLatentW },
                    ventilation: { details: `${ventilationLs.toFixed(0)} L/s`, sensibleW: ventilationLoad.sensible, latentW: ventilationLoad.latent },
                    totalSystem: { details: '', sensibleW: totalZoneSensibleW + ventilationLoad.sensible, latentW: totalZoneLatentW + ventilationLoad.latent }
                }
            },
            heating: {
                oa_db_wb: `${i.conditions.winterOutdoorDB.toFixed(1)} °C`,
                details: {
                    wall: { details: `${i.envelope.wallArea.toFixed(1)} m²`, sensibleW: heatingWallLoad, latentW: 0 },
                    roof: { details: `${i.envelope.roofArea.toFixed(1)} m²`, sensibleW: heatingRoofLoad, latentW: 0 },
                    window: { details: `${i.envelope.windowArea.toFixed(1)} m²`, sensibleW: heatingWindowLoad, latentW: 0 },
                    infiltration: { details: `${i.ventilation.infiltrationACH.toFixed(1)} ACH`, sensibleW: heatingInfiltrationLoad, latentW: 0 },
                    totalZone: { details: '', sensibleW: heatingWallLoad + heatingRoofLoad + heatingWindowLoad + heatingInfiltrationLoad, latentW: 0 },
                    ventilation: { details: `${ventilationLs.toFixed(0)} L/s`, sensibleW: heatingVentilationLoad, latentW: 0 },
                    totalSystem: { details: '', sensibleW: totalHeatingLoadW, latentW: 0 }
                }
            },
            totalConditioning: {
                sensibleW: totalZoneSensibleW + ventilationLoad.sensible, latentW: totalZoneLatentW + ventilationLoad.latent,
                sensibleW_heating: totalHeatingLoadW, latentW_heating: 0
            }
        },
        psychrometrics: {
            coolingDay: "Jul 1600",
            cooling_points: [outdoorAir, mixedAir, leavingCoilAir, supplyAir, indoorAir],
            cooling_table: [
                { component: "Ventilation Air", location: "Outdoor Air", dryBulbC: outdoorAir.dryBulb, specificHumidity: outdoorAir.humidityRatio, airflowLs: ventilationLs, co2LevelPpm: 400, sensibleHeatW: ventilationLoad.sensible, latentHeatW: ventilationLoad.latent },
                { component: "Vent/Return Mixing", location: "Mixed Air", dryBulbC: mixedAir.dryBulb, specificHumidity: mixedAir.humidityRatio, airflowLs: supplyAirflowLs, co2LevelPpm: 400, sensibleHeatW: 0, latentHeatW: 0 },
                { component: "Central Cooling Coil", location: "Coil Outlet", dryBulbC: leavingCoilAir.dryBulb, specificHumidity: leavingCoilAir.humidityRatio, airflowLs: supplyAirflowLs, co2LevelPpm: 400, sensibleHeatW: sensibleCoilLoadW, latentHeatW: latentCoilLoadW },
                { component: "Supply Fan", location: "Fan Outlet", dryBulbC: supplyAir.dryBulb, specificHumidity: supplyAir.humidityRatio, airflowLs: supplyAirflowLs, co2LevelPpm: 400, sensibleHeatW: fanPowerW, latentHeatW: 0 },
                { component: "Zone Air", location: "Room Air", dryBulbC: indoorAir.dryBulb, specificHumidity: indoorAir.humidityRatio, airflowLs: supplyAirflowLs, co2LevelPpm: 400, sensibleHeatW: totalZoneSensibleW, latentHeatW: totalZoneLatentW }
            ],
            cooling_zone_data: { sensibleLoadW: totalZoneSensibleW, thermostatMode: "Cooling", zoneConditionW: totalZoneSensibleW + totalZoneLatentW, zoneTempC: indoorAir.dryBulb, airflowLs: supplyAirflowLs, co2LevelPpm: 400, terminalHeatingCoilW: 0, zoneHeatingUnitW: 0 },
            heating_table: [],
            heating_zone_data: { sensibleLoadW: 0, thermostatMode: "Heating", zoneConditionW: 0, zoneTempC: 0, airflowLs: 0, co2LevelPpm: 0, terminalHeatingCoilW: 0, zoneHeatingUnitW: 0 }
        },
        legacy: {
            totalLoadTons: (finalTotalCoilLoadW / 1000) * WATT_TO_TON_FACTOR,
            airflowCFM: supplyAirflowLs * LS_TO_CFM
        }
    };
    
    setResults(newResults);
    return newResults;
  }, [inputs]);

  const handleNext = () => {
    setCurrentStep(prev => Math.min(prev + 1, 5));
  };
  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleCalculate = () => {
    const res = calculateAll();
    if (res) {
        setCurrentStep(5);
    }
  };

  const handleSaveClick = () => {
    if (!inputs.projectName || !inputs.projectName.trim()) {
        showNotification(t('pleaseEnterProjectName'));
        return;
    }
    if (!results) {
        showNotification(t('cannotSaveBeforeCalc'));
        return;
    }
    onSaveProject(inputs, results);
    showNotification(t('projectSavedLocally', { projectName: inputs.projectName }));
  };

  const handleInputChange = (section: keyof InputState, field: any, value: any) => {
    const processedValue = typeof value === 'number' && isNaN(value) ? '' : value;
    setInputs(prev => {
      if (field === null) {
        return { ...prev, [section]: processedValue };
      }
      return {
        ...prev,
        [section]: {
          ...(prev[section] as object),
          [field]: processedValue
        }
      };
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    const element = document.getElementById('print-section');
    if (!element) {
        console.error("Report element not found for PDF generation.");
        return;
    }

    const filename = (inputs.projectName || 'emaar_hvac_report').replace(/\s+/g, '_') + '.pdf';

    const opt = {
        margin: 0.3,
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    if (window.html2pdf) {
        window.html2pdf().from(element).set(opt).save();
    } else {
        showNotification('PDF library is loading or not available. Please try print dialog.');
    }
};

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 sm:p-6 lg:p-8 font-sans print:bg-white print:p-0">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-cyan-600 text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-2 text-sm font-semibold border border-cyan-400 animate-bounce">
          <CheckCircleIcon className="w-5 h-5" />
          <span>{toastMessage}</span>
        </div>
      )}

      <header className="mb-8 flex flex-col md:flex-row justify-between items-center pb-4 border-b border-gray-700 gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <ThermometerIcon className="h-8 w-8 text-cyan-400" />
            <span>Emaar HVAC Calculator</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">{t('headerSubtitle')}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => onNavigate('home')} className="bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold py-2 px-4 rounded-lg border border-gray-700 transition text-sm">
            {t('nav_home')}
          </button>
          <button onClick={() => onNavigate('projects')} className="bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold py-2 px-4 rounded-lg border border-gray-700 transition text-sm">
            {t('nav_projects')}
          </button>
          <LanguageSwitcher />
        </div>
      </header>

      <div className="max-w-7xl mx-auto">
        <div className="mb-8 print:hidden">
            <div className="flex justify-between items-center relative">
                <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-gray-700 z-0"></div>
                {STEPS.map((step) => (
                    <div 
                        key={step.number} 
                        className={`relative z-10 flex flex-col items-center cursor-pointer ${step.number <= currentStep ? 'text-cyan-400' : 'text-gray-500'}`}
                        onClick={() => {
                            if (step.number === 5 && !results) return;
                            setCurrentStep(step.number);
                        }}
                    >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-all border-2 ${step.number === currentStep ? 'bg-cyan-500 text-gray-900 border-cyan-400 scale-110 shadow-lg shadow-cyan-500/30' : step.number < currentStep ? 'bg-gray-800 border-cyan-400 text-cyan-400' : 'bg-gray-800 border-gray-600'}`}>
                            {step.number < currentStep ? '✓' : step.number}
                        </div>
                        <span className="text-xs font-semibold mt-2 hidden sm:block text-center">{step.title}</span>
                    </div>
                ))}
            </div>
        </div>

        <div className="bg-gray-800 p-6 sm:p-8 rounded-xl border border-gray-700 min-h-[420px] flex flex-col justify-between print:bg-transparent print:p-0 print:border-none">
            {currentStep === 1 && (
                <div>
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><FolderIcon />{t('calculator_step_title_1')}</h2>
                    <div className="mb-6 text-center">
                        <button 
                            onClick={() => setInputs(placeholderInputs)}
                            className="text-cyan-400 border border-cyan-400/50 hover:bg-cyan-400 hover:text-gray-900 font-semibold py-2 px-4 rounded-lg transition text-sm shadow-sm"
                        >
                            {t('loadExampleData')}
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <InputGroup label={t('projectName')} type="text" value={inputs.projectName} onChange={e => handleInputChange('projectName', null, e.target.value)} placeholder={placeholderInputs.projectName}/>
                        <InputGroup label={t('preparedBy')} type="text" value={inputs.preparedBy} onChange={e => handleInputChange('preparedBy', null, e.target.value)} placeholder={placeholderInputs.preparedBy}/>
                        <InputGroup label={t('location')} type="text" value={inputs.location} onChange={e => handleInputChange('location', null, e.target.value)} placeholder={placeholderInputs.location}/>
                        
                        <InputGroup 
                          label={t('roomLength')} 
                          type="number" 
                          value={inputs.zone.roomLength ?? ''} 
                          onChange={e => {
                            const l = parseFloat(e.target.value);
                            const w = typeof inputs.zone.roomWidth === 'number' ? inputs.zone.roomWidth : 0;
                            handleInputChange('zone', 'roomLength', isNaN(l) ? '' : l);
                            if (!isNaN(l) && l > 0 && w > 0) {
                              handleInputChange('zone', 'floorArea', Number((l * w).toFixed(2)));
                            }
                          }} 
                        />
                        <InputGroup 
                          label={t('roomWidth')} 
                          type="number" 
                          value={inputs.zone.roomWidth ?? ''} 
                          onChange={e => {
                            const w = parseFloat(e.target.value);
                            const l = typeof inputs.zone.roomLength === 'number' ? inputs.zone.roomLength : 0;
                            handleInputChange('zone', 'roomWidth', isNaN(w) ? '' : w);
                            if (!isNaN(w) && w > 0 && l > 0) {
                              handleInputChange('zone', 'floorArea', Number((l * w).toFixed(2)));
                            }
                          }} 
                        />

                        <InputGroup label={t('floorArea')} type="number" value={inputs.zone.floorArea} onChange={e => handleInputChange('zone', 'floorArea', parseFloat(e.target.value))} />
                        <InputGroup label={t('ceilingHeight')} type="number" value={inputs.zone.ceilingHeight} onChange={e => handleInputChange('zone', 'ceilingHeight', parseFloat(e.target.value))} />
                        <InputGroup label={t('designAirflowLs')} type="number" value={inputs.system.designAirflowLs} onChange={e => handleInputChange('system', 'designAirflowLs', parseFloat(e.target.value))} placeholder="Auto-calculated if empty" />
                        <SelectGroup label={t('equipmentClass')} value={inputs.system.equipmentClass} onChange={e => handleInputChange('system', 'equipmentClass', e.target.value)} options={[{value: 'pkg_roof', label: t('eq_class_pkg_roof')}, {value: 'split_dx', label: t('eq_class_split_dx')}, {value: 'chiller_fcu', label: t('eq_class_chiller_fcu')}]}/>
                        <InputGroup label={t('fanStaticPa')} type="number" value={inputs.system.fanStaticPa} onChange={e => handleInputChange('system', 'fanStaticPa', parseFloat(e.target.value))} />
                        <InputGroup label={t('fanEfficiency')} type="number" value={inputs.system.fanEfficiency} onChange={e => handleInputChange('system', 'fanEfficiency', parseFloat(e.target.value))} />
                    </div>
                </div>
            )}
            {currentStep === 2 && (
                 <div>
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><UsersIcon />{t('calculator_step_title_2')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputGroup label={t('peopleCount')} type="number" value={inputs.people.count} onChange={e => handleInputChange('people', 'count', parseInt(e.target.value, 10))} />
                        <SelectGroup label={t('activityLevel')} value={inputs.people.activity} onChange={e => handleInputChange('people', 'activity', e.target.value)} options={[{value: 'sitting', label: t('activity_sitting')}, {value: 'light_work', label: t('activity_light_work')}, {value: 'heavy_work', label: t('activity_heavy_work')}, {value: 'custom_mosque', label: t('activity_custom_mosque')}]}/>
                        <InputGroup label={t('totalLightingPower')} type="number" value={inputs.lighting.loadW} onChange={e => handleInputChange('lighting', 'loadW', parseFloat(e.target.value))} />
                        <InputGroup label={t('totalAppliancePower')} type="number" value={inputs.equipment.loadW} onChange={e => handleInputChange('equipment', 'loadW', parseFloat(e.target.value))} />
                    </div>
                </div>
            )}
             {currentStep === 3 && (
                 <div>
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><BuildingIcon />{t('calculator_step_title_3')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputGroup label={t('windowArea')} type="number" value={inputs.envelope.windowArea} onChange={e => handleInputChange('envelope', 'windowArea', parseFloat(e.target.value))} />
                        <InputGroup label={t('windowUValue')} type="number" value={inputs.envelope.windowUValue} onChange={e => handleInputChange('envelope', 'windowUValue', parseFloat(e.target.value))} />
                        <InputGroup label={t('wallArea')} type="number" value={inputs.envelope.wallArea} onChange={e => handleInputChange('envelope', 'wallArea', parseFloat(e.target.value))} />
                        <InputGroup label={t('wallUValue')} type="number" value={inputs.envelope.wallUValue} onChange={e => handleInputChange('envelope', 'wallUValue', parseFloat(e.target.value))} />
                        <InputGroup label={t('ceilingArea')} type="number" value={inputs.envelope.roofArea} onChange={e => handleInputChange('envelope', 'roofArea', parseFloat(e.target.value))} />
                        <InputGroup label={t('roofUValue')} type="number" value={inputs.envelope.roofUValue} onChange={e => handleInputChange('envelope', 'roofUValue', parseFloat(e.target.value))} />
                        <InputGroup label={t('solarLoadW')} type="number" value={inputs.envelope.solarLoadW} onChange={e => handleInputChange('envelope', 'solarLoadW', parseFloat(e.target.value))} />
                    </div>
                </div>
            )}
            {currentStep === 4 && (
                 <div>
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><ThermometerIcon className="h-6 w-6 text-cyan-400" />{t('calculator_step_title_4')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputGroup label={t('outdoorTemp')} type="number" value={inputs.conditions.outdoorDB} onChange={e => handleInputChange('conditions', 'outdoorDB', parseFloat(e.target.value))} />
                        <InputGroup label={t('outdoorWBT')} type="number" value={inputs.conditions.outdoorWB} onChange={e => handleInputChange('conditions', 'outdoorWB', parseFloat(e.target.value))} />
                        <InputGroup label={t('indoorTemp')} type="number" value={inputs.conditions.indoorDB} onChange={e => handleInputChange('conditions', 'indoorDB', parseFloat(e.target.value))} />
                        <InputGroup label={t('indoorRH')} type="number" value={inputs.conditions.indoorRH} onChange={e => handleInputChange('conditions', 'indoorRH', parseFloat(e.target.value))} />
                        <InputGroup label={t('winterOutdoorDB')} type="number" value={inputs.conditions.winterOutdoorDB} onChange={e => handleInputChange('conditions', 'winterOutdoorDB', parseFloat(e.target.value))} />
                        <InputGroup label={t('lsPerPerson')} type="number" value={inputs.ventilation.lsPerPerson} onChange={e => handleInputChange('ventilation', 'lsPerPerson', parseFloat(e.target.value))} />
                        <InputGroup label={t('infiltrationACH')} type="number" value={inputs.ventilation.infiltrationACH} onChange={e => handleInputChange('ventilation', 'infiltrationACH', parseFloat(e.target.value))} />
                        <InputGroup label={t('safetyFactor')} type="number" value={inputs.system.safetyFactor} onChange={e => handleInputChange('system', 'safetyFactor', parseFloat(e.target.value))} />
                    </div>
                </div>
            )}
            {currentStep === 5 && results && (
                <div>
                    <div className="flex justify-between items-center mb-6 print:hidden">
                        <h3 className="text-xl font-bold text-cyan-400">{t('quickSummaryTitle')}</h3>
                        <div className="flex gap-2">
                          <button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition text-sm"><PrintIcon />{t('print')}</button>
                          <button onClick={handleDownloadPdf} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition text-sm"><DownloadIcon />{t('downloadPdf')}</button>
                        </div>
                    </div>

                    {/* Quick Executive Summary Dashboard */}
                    <ExecutiveDashboard results={results} />

                    <div className="mt-8">
                      <FullReport results={results} inputs={inputs}/>
                    </div>
                </div>
            )}

            <div className="mt-8 pt-6 border-t border-gray-700 flex justify-between items-center print:hidden">
                <div>{currentStep > 1 && <button onClick={handleBack} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-lg transition-colors text-sm">{t('back')}</button>}</div>
                <div>
                    {currentStep < 4 && <button onClick={handleNext} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-6 rounded-lg transition-colors text-sm">{t('next')}</button>}
                    {currentStep === 4 && <button onClick={handleCalculate} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-8 rounded-lg text-base shadow-lg transition">{t('calculateNow')}</button>}
                    {currentStep === 5 && <button onClick={handleSaveClick} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-lg transition-colors text-sm">{t('temporarySave')}</button>}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

// Executive Dashboard Cards
const ExecutiveDashboard: React.FC<{results: ResultsState}> = ({results}) => {
  const { t } = useLanguage();
  const tons = results.legacy.totalLoadTons;
  const kw = results.airSystemSizingSummary.cooling.totalCoilLoadKW;
  const btu = Math.round(tons * 12000);
  const cfm = results.legacy.airflowCFM;
  const ls = results.airSystemSizingSummary.cooling.coilAirflowLs;
  const duct = results.ductAndMaterials?.duct;
  const materials = results.ductAndMaterials?.materials;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 print:hidden">
      <div className="bg-gray-900/80 border border-cyan-500/30 p-4 rounded-xl shadow-md">
        <div className="flex justify-between items-start">
          <span className="text-gray-400 text-xs font-semibold uppercase">{t('totalCoolingLoad')}</span>
          <ThermometerIcon className="w-5 h-5 text-cyan-400" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-black text-cyan-400">{tons.toFixed(1)}</span>
          <span className="text-sm text-gray-300 font-bold">Tons</span>
        </div>
        <div className="mt-1 text-xs text-gray-400 flex gap-3">
          <span>{kw.toFixed(1)} kW</span>
          <span>•</span>
          <span>{btu.toLocaleString()} BTU/hr</span>
        </div>
      </div>

      <div className="bg-gray-900/80 border border-cyan-500/30 p-4 rounded-xl shadow-md">
        <div className="flex justify-between items-start">
          <span className="text-gray-400 text-xs font-semibold uppercase">{t('requiredAirflow')}</span>
          <WindIcon className="w-5 h-5 text-cyan-400" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-black text-cyan-400">{cfm.toLocaleString()}</span>
          <span className="text-sm text-gray-300 font-bold">CFM</span>
        </div>
        <div className="mt-1 text-xs text-gray-400">
          <span>{ls.toFixed(0)} L/s (at peak coil)</span>
        </div>
      </div>

      <div className="bg-gray-900/80 border border-cyan-500/30 p-4 rounded-xl shadow-md">
        <div className="flex justify-between items-start">
          <span className="text-gray-400 text-xs font-semibold uppercase">{t('ductDimensions')}</span>
          <RulerIcon className="w-5 h-5 text-cyan-400" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-xl font-bold text-white">{duct?.rectangularWidthInches}" × {duct?.rectangularHeightInches}"</span>
          <span className="text-xs text-gray-400">(Rectangular)</span>
        </div>
        <div className="mt-1 text-xs text-gray-400">
          <span>Circular: {duct?.circularDiameterInches}" dia ({duct?.circularDiameterCm} cm)</span>
        </div>
      </div>

      <div className="bg-gray-900/80 border border-cyan-500/30 p-4 rounded-xl shadow-md">
        <div className="flex justify-between items-start">
          <span className="text-gray-400 text-xs font-semibold uppercase">{t('fanPower')}</span>
          <CalculatorIcon className="w-5 h-5 text-cyan-400" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white">{results.airSystemSizingSummary.supplyFan.fanMotorBHP.toFixed(2)}</span>
          <span className="text-sm text-gray-300 font-bold">BHP</span>
        </div>
        <div className="mt-1 text-xs text-gray-400">
          <span>{results.airSystemSizingSummary.supplyFan.fanMotorKW.toFixed(2)} kW • Static: {results.airSystemSizingSummary.supplyFan.fanStaticPa} Pa</span>
        </div>
      </div>

      <div className="bg-gray-900/80 border border-cyan-500/30 p-4 rounded-xl shadow-md">
        <div className="flex justify-between items-start">
          <span className="text-gray-400 text-xs font-semibold uppercase">{t('materialQuantities')}</span>
          <BuildingIcon className="w-5 h-5 text-cyan-400" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-xl font-bold text-white">{materials?.sheetMetalSqM} m²</span>
          <span className="text-xs text-gray-400">Sheet Metal</span>
        </div>
        <div className="mt-1 text-xs text-gray-400 flex gap-2">
          <span>Insu: {materials?.insulationSqM} m²</span>
          <span>•</span>
          <span>Flanges: {materials?.flangesPcs} pcs</span>
        </div>
      </div>

      <div className="bg-gray-900/80 border border-cyan-500/30 p-4 rounded-xl shadow-md">
        <div className="flex justify-between items-start">
          <span className="text-gray-400 text-xs font-semibold uppercase">{t('heatingLoad')}</span>
          <ThermometerIcon className="w-5 h-5 text-amber-400" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-amber-400">{results.airSystemSizingSummary.heating.maxCoilLoadKW.toFixed(1)}</span>
          <span className="text-sm text-gray-300 font-bold">kW</span>
        </div>
        <div className="mt-1 text-xs text-gray-400">
          <span>At winter outdoor DB: {results.designLoadSummary.heating.oa_db_wb}</span>
        </div>
      </div>
    </div>
  );
};

// Helper Input Components
const InputGroup: React.FC<{label: string; type: string; value: number | string; onChange: (e: any) => void; placeholder?: string;}> = ({ label, type, value, onChange, placeholder }) => (
  <div>
    <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
    <input type={type} value={value} onChange={onChange} min="0" step="any" placeholder={placeholder} className="w-full bg-gray-700/80 p-2.5 rounded-lg border border-gray-600 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 placeholder:text-gray-500 text-sm" />
  </div>
);
const SelectGroup: React.FC<{label: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; options: { value: string; label: string }[];}> = ({ label, value, onChange, options }) => (
  <div>
    <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
    <select value={value} onChange={onChange} className="w-full bg-gray-700/80 p-2.5 rounded-lg border border-gray-600 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-sm">
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  </div>
);

// Report Components
const FullReport: React.FC<{results: ResultsState, inputs: InputState}> = ({results, inputs}) => {
    return (
        <div id="print-section" className="bg-white text-gray-900 rounded-xl p-2 sm:p-6 shadow-2xl border border-gray-200">
            <ReportPage1 r={results} i={inputs} />
            <ReportPage2 r={results} />
            <ReportPage3 r={results} />
            <ReportPage4 r={results} />
            <ReportPage5 r={results} />
            <ReportPage6 r={results} />
            <ReportPageDuct r={results} />
        </div>
    );
}

const ReportPageWrapper: React.FC<{r: ResultsState; title: string; pageNum: number; children: React.ReactNode}> = ({r, title, pageNum, children}) => {
    const { t } = useLanguage();
    return (
        <div className="p-6 border border-gray-300 bg-white text-gray-900 font-mono text-xs leading-5 break-after-page mb-8 shadow-sm rounded-lg print:border-none print:shadow-none print:mb-0 print:p-0">
            <header className="flex justify-between items-start pb-3 border-b-2 border-gray-900">
                <div>
                    <p className="font-bold">{t('projectName')}: {r.projectInfo.projectName}</p>
                    <p>{t('preparedBy')}: {r.projectInfo.preparedBy}</p>
                </div>
                <h2 className="text-base font-bold text-center text-cyan-900">{title}</h2>
                <div className="text-right">
                    <p>{r.projectInfo.date}</p>
                    <p>{r.projectInfo.time}</p>
                </div>
            </header>
            <main className="my-5">
                {children}
            </main>
            <footer className="flex justify-between items-center pt-3 border-t border-gray-300 text-gray-600 text-[11px]">
                <span className="font-semibold">Emaar HVAC Calculation System v1.0.0</span>
                <span>Page {pageNum} of 7</span>
            </footer>
        </div>
    )
};

const ReportRow: React.FC<{label: string; value: string | number; unit?: string; className?: string}> = ({ label, value, unit, className}) => (
    <div className={`flex justify-between items-baseline my-1 ${className}`}>
      <span className="text-gray-700 font-medium">{label}</span>
      <span className="flex-1 border-b border-dotted border-gray-300 mx-2"></span>
      <span className="text-right font-bold text-gray-900 min-w-[80px]">{value} {unit}</span>
    </div>
);

const ReportPage1: React.FC<{r: ResultsState, i: InputState}> = ({r, i}) => {
    const { t } = useLanguage();
    const { airSystemSizingSummary: d, projectInfo } = r;
    const getVal = (val: number | '') => val === '' ? 'N/A' : val;
    return (
        <ReportPageWrapper r={r} title={t('report_title_header', {projectName: projectInfo.projectName})} pageNum={1}>
            <section className="mt-4">
                <h3 className="font-bold border-b border-gray-800 mb-2 pb-1 text-sm text-cyan-900">{t('airSystemInfo')}</h3>
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
                 <h3 className="font-bold border-b border-gray-800 mb-2 pb-1 text-sm text-cyan-900">{t('coolingCoilSizing')}</h3>
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
                 <h3 className="font-bold border-b border-gray-800 mb-2 pb-1 text-sm text-cyan-900">{t('heatingCoilSizing')}</h3>
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
                 <h3 className="font-bold border-b border-gray-800 mb-2 pb-1 text-sm text-cyan-900">{t('supplyFanSizing')}</h3>
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
                <h3 className="font-bold border-b border-gray-800 mb-2 pb-1 text-sm text-cyan-900">{t('environmentalSummary')}</h3>
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
                <h3 className="font-bold border-b border-gray-800 mb-2 pb-1 text-sm text-cyan-900">{t('airSystemInfo')}</h3>
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
                <h3 className="font-bold border-b border-gray-800 mb-2 pb-1 text-sm text-cyan-900">{t('sizingCalcInfo')}</h3>
                <div className="grid grid-cols-2 gap-x-8">
                   <ReportRow label={t('calculationMonths')} value={d.calculationMonths} />
                   <ReportRow label={t('zoneLssSizing')} value={d.zoneLssSizing} />
                   <ReportRow label={t('sizingData')} value={d.sizingData} />
                   <ReportRow label={t('spaceLssSizing')} value={d.spaceLssSizing} />
                </div>
            </section>
            <section className="mt-4">
                <h3 className="font-bold border-b border-gray-800 mb-2 pb-1 text-sm text-cyan-900">{t('zoneSizingData')}</h3>
                 <table className="w-full text-left table-auto border border-gray-200">
                    <thead className="bg-gray-100">
                        <tr className="text-gray-700 text-[10px]"><th className="p-1">{t('zoneName')}</th><th className="p-1">{t('maxCoolingSensibleKW')}</th><th className="p-1">{t('designAirflowLs_zone')}</th><th className="p-1">{t('minAirflowLs')}</th><th className="p-1">{t('timeOfPeak')}</th><th className="p-1">{t('maxHeatingLoadKW')}</th><th className="p-1">{t('areaM2')}</th><th className="p-1">{t('zoneLssqm')}</th></tr>
                    </thead>
                    <tbody>
                        <tr className="border-t border-gray-200"><td className="p-1">{z.zoneName}</td><td className="p-1">{z.coolingSensibleKW.toFixed(1)}</td><td className="p-1">{z.designAirflowLs.toFixed(0)}</td><td className="p-1">{z.minAirflowLs.toFixed(0)}</td><td className="p-1">{z.timeOfPeakLoad}</td><td className="p-1">{z.heatingLoadKW.toFixed(1)}</td><td className="p-1">{z.floorArea.toFixed(1)}</td><td className="p-1">{z.lsPerSqm.toFixed(2)}</td></tr>
                    </tbody>
                </table>
            </section>
            <section className="mt-4">
                <h3 className="font-bold border-b border-gray-800 mb-2 pb-1 text-sm text-cyan-900">{t('zoneTerminalSizing')}</h3>
                <p className="italic text-gray-500">{t('noZoneTerminalData')}</p>
            </section>
            <section className="mt-4">
                <h3 className="font-bold border-b border-gray-800 mb-2 pb-1 text-sm text-cyan-900">{t('spaceLoadsAndAirflows')}</h3>
                 <table className="w-full text-left table-auto border border-gray-200">
                    <thead className="bg-gray-100"><tr className="text-gray-700 text-[10px]"><th className="p-1">{t('zoneNameSpaceName')}</th><th className="p-1">Mult.</th><th className="p-1">{t('coolingSensibleKW')}</th><th className="p-1">{t('timeOfLoad')}</th><th className="p-1">{t('airflowLs')}</th><th className="p-1">{t('heatingLoadKW')}</th><th className="p-1">{t('areaM2')}</th><th className="p-1">{t('spaceLssqm')}</th></tr></thead>
                    <tbody>
                        <tr className="border-t border-gray-200"><td className="p-1 font-bold">{z.zoneName}</td><td className="p-1"></td><td className="p-1"></td><td className="p-1"></td><td className="p-1"></td><td className="p-1"></td><td className="p-1"></td><td className="p-1"></td></tr>
                        <tr className="border-t border-gray-100"><td className="p-1 pl-4">{s.spaceName}</td><td className="p-1">1</td><td className="p-1">{s.coolingSensibleKW.toFixed(1)}</td><td className="p-1">{s.timeOfLoad}</td><td className="p-1">{s.airflowLs.toFixed(0)}</td><td className="p-1">{s.heatingLoadKW.toFixed(1)}</td><td className="p-1">{s.floorArea.toFixed(1)}</td><td className="p-1">{s.spaceLsPerSqm.toFixed(2)}</td></tr>
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
                <div className="font-bold text-center text-cyan-900">{t('designCooling')}</div>
                <div className="font-bold text-center text-cyan-900">{t('designHeating')}</div>
                <div className="text-center text-xs text-gray-600">{t('coolingDataAt')} {d.cooling.oa_db_wb}</div>
                <div className="text-center text-xs text-gray-600">{t('heatingDataAt')} {d.heating.oa_db_wb}</div>
            </div>
            <table className="w-full mt-3 border border-gray-200">
                <thead className="bg-gray-100">
                    <tr className="text-[10px] text-gray-700">
                        <th className="w-1/4 text-left p-1">{t('zoneLoads')}</th>
                        <th className="w-1/12 text-left p-1">{t('details')}</th>
                        <th className="w-1/12 text-right p-1">{t('sensibleW')}</th>
                        <th className="w-1/12 text-right p-1">{t('latentW')}</th>
                        <th className="w-1/12 p-1"></th>
                        <th className="w-1/4 text-left p-1">{t('details')}</th>
                        <th className="w-1/12 text-right p-1">{t('sensibleW')}</th>
                        <th className="w-1/12 text-right p-1">{t('latentW')}</th>
                    </tr>
                </thead>
                <tbody>
                    {coolingOrder.map((key, i) => {
                        const cKey = coolingOrder[i];
                        const hKey = heatingOrder[i];
                        const cData = d.cooling.details[cKey];
                        const hData = d.heating.details[hKey];
                        const isTotal = cKey.includes('total');
                        const rowClass = isTotal ? "font-bold bg-gray-50 border-t border-b border-gray-300" : "border-t border-gray-100";
                        return (
                            <tr key={cKey} className={rowClass}>
                                <td className="text-left p-1">{t(`load_${cKey}`)}</td>
                                <td className="text-left p-1">{cData?.details || ''}</td>
                                <td className="text-right p-1">{cData ? cData.sensibleW.toFixed(0) : '-'}</td>
                                <td className="text-right p-1">{cData ? cData.latentW.toFixed(0) : '-'}</td>
                                <td className="w-1/12 p-1"></td>
                                { hKey && hData ?
                                <>
                                <td className="text-left p-1">{hData.details || ''}</td>
                                <td className="text-right p-1">{hData.sensibleW.toFixed(0)}</td>
                                <td className="text-right p-1">{hData.latentW.toFixed(0)}</td>
                                </>
                                : <><td className="p-1"></td><td className="p-1"></td><td className="p-1"></td></>
                                }
                            </tr>
                        )
                    })}
                     <tr className="font-bold border-t-2 border-b-2 border-gray-800 bg-gray-100 my-2">
                        <td className="p-1">{t('totalConditioning')}</td><td className="p-1"></td>
                        <td className="text-right p-1">{r.designLoadSummary.totalConditioning.sensibleW.toFixed(0)}</td>
                        <td className="text-right p-1">{r.designLoadSummary.totalConditioning.latentW.toFixed(0)}</td>
                        <td className="p-1"></td><td className="p-1"></td>
                        <td className="text-right p-1">{r.designLoadSummary.totalConditioning.sensibleW_heating.toFixed(0)}</td>
                        <td className="text-right p-1">{r.designLoadSummary.totalConditioning.latentW_heating.toFixed(0)}</td>
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
            <h3 className="font-bold text-center mb-2 text-cyan-900">{title}</h3>
            <h4 className="font-bold mb-1 text-xs">TABLE 1: SYSTEM DATA</h4>
            <table className="w-full text-left table-auto border border-gray-200">
                <thead className="bg-gray-100"><tr className="text-gray-700 text-[10px]"><th className="p-1 w-1/4">{t('component')}</th><th className="p-1">{t('location')}</th><th className="p-1">{t('dryBulbTempC')}</th><th className="p-1">{t('specificHumidity')}</th><th className="p-1">{t('airflowLs')}</th><th className="p-1">{t('co2Level')}</th><th className="p-1">{t('sensibleHeatW')}</th><th className="p-1">{t('latentHeatW')}</th></tr></thead>
                <tbody>{tableData.map(row => <tr key={row.component} className="border-t border-gray-100"><td className="p-1">{row.component}</td><td className="p-1">{row.location}</td><td className="p-1">{row.dryBulbC.toFixed(1)}</td><td className="p-1">{row.specificHumidity.toFixed(5)}</td><td className="p-1">{row.airflowLs.toFixed(0)}</td><td className="p-1">{row.co2LevelPpm}</td><td className="p-1">{row.sensibleHeatW.toFixed(0)}</td><td className="p-1">{row.latentHeatW.toFixed(0)}</td></tr>)}</tbody>
            </table>
             <p className="text-[10px] italic mt-2 text-gray-600">{t('psychro_note', {alt: '16.8'})}</p>
            <h4 className="font-bold mb-1 mt-4 text-xs">TABLE 2: ZONE DATA</h4>
            <table className="w-full text-left table-auto border border-gray-200">
                <thead className="bg-gray-100"><tr className="text-gray-700 text-[10px]"><th className="p-1">{t('zoneName')}</th><th className="p-1">{t('zoneSensibleLoadW')}</th><th className="p-1">{t('tstatMode')}</th><th className="p-1">{t('zoneCondW')}</th><th className="p-1">{t('zoneTempC')}</th><th className="p-1">{t('airflowLs')}</th><th className="p-1">{t('co2Level')}</th><th className="p-1">{t('terminalHeatingCoilW')}</th><th className="p-1">{t('zoneHeatingUnitW')}</th></tr></thead>
                <tbody><tr className="border-t border-gray-100"><td className="p-1">Zone 1</td><td className="p-1">{zoneData.sensibleLoadW.toFixed(0)}</td><td className="p-1">{zoneData.thermostatMode}</td><td className="p-1">{zoneData.zoneConditionW.toFixed(0)}</td><td className="p-1">{zoneData.zoneTempC.toFixed(1)}</td><td className="p-1">{zoneData.airflowLs.toFixed(0)}</td><td className="p-1">{zoneData.co2LevelPpm}</td><td className="p-1">{zoneData.terminalHeatingCoilW.toFixed(0)}</td><td className="p-1">{zoneData.zoneHeatingUnitW.toFixed(0)}</td></tr></tbody>
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
        { x: tempToX(cooling_points[0].dryBulb), y: humToY(cooling_points[0].humidityRatio), label: '1' },
        { x: tempToX(cooling_points[1].dryBulb), y: humToY(cooling_points[1].humidityRatio), label: '2' },
        { x: tempToX(cooling_points[2].dryBulb), y: humToY(cooling_points[2].humidityRatio), label: '3' },
        { x: tempToX(cooling_points[3].dryBulb), y: humToY(cooling_points[3].humidityRatio), label: '4' },
        { x: tempToX(cooling_points[4].dryBulb), y: humToY(cooling_points[4].humidityRatio), label: '5' },
    ];

    const linePath = `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y} L ${points[2].x} ${points[2].y}`;
    const roomLinePath = `M ${points[3].x} ${points[3].y} L ${points[4].x} ${points[4].y}`;

    return (
        <ReportPageWrapper r={r} title={t('report_title_psychro_analysis', {projectName: r.projectInfo.projectName})} pageNum={6}>
            <div className="text-center text-xs">
                <p>{t('location')}: {r.projectInfo.location}</p>
                <p>{t('altitude')}: {r.projectInfo.altitude} m.</p>
                <p>{t('dataFor')}: {coolingDay}</p>
            </div>
            <div className="flex mt-4">
                <div className="text-xs flex flex-col justify-center space-y-1">
                    <span>1. {t('outdoorAir')}</span><span>2. {t('mixedAir')}</span><span>3. {t('centralCoolingCoilOutlet')}</span><span>4. {t('supplyFanOutlet')}</span><span>5. {t('roomAir')}</span>
                </div>
                <div className="relative ml-4">
                    <svg width={width + 50} height={height + 50} viewBox="-20 -20 570 340" className="bg-white border border-gray-400 shadow-inner">
                        <g className="text-[8px] fill-current text-gray-800">
                            {Array.from({length: 11}).map((_, i) => {
                                const hum = humMin + (humMax-humMin) / 10 * i;
                                const y = humToY(hum);
                                return <React.Fragment key={i}><text x={width + 5} y={y + 3}>{hum.toFixed(4)}</text><line x1="0" y1={y} x2={width} y2={y} stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="2,2"/></React.Fragment>
                            })}
                             <text transform={`translate(${width + 45}, ${height/2}) rotate(-90)`} textAnchor="middle">{t('specificHumidityKgKg')}</text>
                        </g>
                        <g className="text-[8px] fill-current text-gray-800">
                            {Array.from({length: 10}).map((_, i) => {
                                const temp = tempMin + (tempMax - tempMin) / 9 * i;
                                const x = tempToX(temp);
                                return <React.Fragment key={i}><text x={x-5} y={height + 15}>{Math.round(temp)}</text><line x1={x} y1="0" x2={x} y2={height} stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="2,2"/></React.Fragment>
                            })}
                            <text x={width/2 - 20} y={height + 30}>{t('temperatureC')}</text>
                        </g>
                        <path d={
                            Array.from({length: 20}).map((_,i) => {
                                const temp = tempMin + (tempMax-tempMin)/19 * i;
                                const hum = getHumidityRatioFromRH(temp, 100);
                                return `${i===0?'M':'L'} ${tempToX(temp)} ${humToY(hum)}`
                            }).join(' ')
                        } stroke="#f59e0b" fill="none" strokeWidth="1.5" />
                        <path d={linePath} stroke="#2563eb" fill="none" strokeWidth="1.5" />
                        <path d={roomLinePath} stroke="#ec4899" fill="none" strokeWidth="1.5" />
                        {points.map(p => <g key={p.label}><circle cx={p.x} cy={p.y} r="3" fill="#dc2626" /><text x={p.x + 5} y={p.y - 5} className="text-[10px] font-bold fill-gray-900">{p.label}</text></g>)}
                    </svg>
                </div>
            </div>
        </ReportPageWrapper>
    );
};

const ReportPageDuct: React.FC<{r: ResultsState}> = ({r}) => {
    const { t } = useLanguage();
    const duct = r.ductAndMaterials?.duct;
    const mat = r.ductAndMaterials?.materials;

    return (
        <ReportPageWrapper r={r} title={t('report_title_duct', {projectName: r.projectInfo.projectName})} pageNum={7}>
            <section className="mt-2">
                <h3 className="font-bold border-b border-gray-800 mb-2 pb-1 text-sm text-cyan-900">{t('ductSizingTitle')}</h3>
                <div className="grid grid-cols-2 gap-x-8">
                    <div>
                        <ReportRow label={t('requiredAirflow')} value={duct?.airflowCFM.toLocaleString() || '0'} unit="CFM" />
                        <ReportRow label={t('requiredAirflow')} value={duct?.airflowLs.toFixed(0) || '0'} unit="L/s" />
                        <ReportRow label={t('ductVelocity')} value={duct?.velocityFPM || 900} unit="FPM" />
                        <ReportRow label={t('ductVelocity')} value={duct?.velocityMs.toFixed(2) || '4.57'} unit="m/s" />
                    </div>
                    <div>
                        <ReportRow label={t('ductArea')} value={duct?.areaSqFt.toFixed(2) || '0'} unit="ft²" />
                        <ReportRow label={t('circularDuctDia')} value={`${duct?.circularDiameterInches}" / ${duct?.circularDiameterCm} cm`} />
                        <ReportRow label={t('rectangularDuctDimensions')} value={`${duct?.rectangularWidthInches}" × ${duct?.rectangularHeightInches}"`} />
                        <ReportRow label={t('rectangularDuctDimensions')} value={`${duct?.rectangularWidthCm} cm × ${duct?.rectangularHeightCm} cm`} />
                    </div>
                </div>
            </section>

            <section className="mt-6">
                <h3 className="font-bold border-b border-gray-800 mb-2 pb-1 text-sm text-cyan-900">{t('materialQuantitiesTitle')}</h3>
                <div className="grid grid-cols-2 gap-x-8">
                    <div>
                        <ReportRow label={t('ductLength')} value={mat?.ductLengthMeters || 10} unit="meters" />
                        <ReportRow label={t('sheetMetalQty')} value={mat?.sheetMetalSqM || 0} unit="m²" />
                        <ReportRow label={t('insulationQty')} value={mat?.insulationSqM || 0} unit="m²" />
                    </div>
                    <div>
                        <ReportRow label={t('flangesQty')} value={mat?.flangesPcs || 0} unit="pcs" />
                        <ReportRow label={t('screwsQty')} value={mat?.screwsPcs || 0} unit="pcs" />
                        <ReportRow label={t('hangersQty')} value={mat?.hangersPcs || 0} unit="pcs" />
                    </div>
                </div>
            </section>
        </ReportPageWrapper>
    );
};

export default CalculatorPage;
