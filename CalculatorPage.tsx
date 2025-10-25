import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { InputState, ResultsState, Project } from './types';
import { useLanguage } from './LanguageContext';
import { 
  HEAT_GAIN_PERSON_WATT, U_VALUE_WINDOW_W_M2K, SOLAR_RADIATION_W_M2,
  U_VALUE_INSULATION_W_M2K, WATT_TO_BTU_FACTOR, WATT_TO_TON_FACTOR,
  CFM_PER_TON, DUCT_AIR_VELOCITY, SAFETY_FACTOR, INCH_TO_M
} from './constants';
import { BuildingIcon, UsersIcon, LightbulbIcon, DocumentReportIcon, FolderIcon, PrintIcon, CheckCircleIcon, ClipboardIcon, DownloadIcon, WindowIcon, PlugIcon, ThermometerIcon } from './Icons';

const initialInputs: InputState = {
  projectName: '',
  room: { length: '', width: '', height: '' },
  people: { count: '', activity: 'sitting' },
  lighting: { wattage: '' },
  windows: { area: '', glassType: 'double', direction: 'south', shading: false },
  appliances: { wattage: '' },
  wallsAndCeiling: { wallArea: '', ceilingArea: '', insulationType: 'standard' },
  environment: { outdoorTemp: '', indoorTemp: 24, buildingType: 'residential' },
};

interface CalculatorPageProps {
  onNavigate: (page: 'home' | 'projects') => void;
  onSaveProject: (inputs: InputState, results: ResultsState) => void;
  activeProject: Project | null;
}

const formatResultsForText = (inputs: InputState, results: ResultsState, t: (key: string, replacements?: { [key: string]: string | number }) => string): string => {
  const getNum = (val: number | '') => val || 0;
  const activity = t(`activity_${inputs.people.activity}`);
  const direction = t(`direction_${inputs.windows.direction}`);

  return `
${t('report_text_title')}
=======================================
${t('report_text_projectName', { projectName: inputs.projectName || '...' })}
${t('report_text_creationDate', { date: new Date().toLocaleString(t.toString().includes('ar') ? 'ar-EG' : 'en-US') })}

${t('report_text_summary')}
${t('report_text_totalLoad', { totalLoadW: results.loads.totalLoadW.toLocaleString(), totalLoadTons: results.loads.totalLoadTons.toFixed(2) })}
${t('report_text_airflow', { cfm: results.airflow.cfm.toFixed(0), velocity: results.airflow.velocityFpm })}
${t('report_text_ductDiameter', { diameter: results.ductSizing.roundDiameterIn.toFixed(1) })}
${t('report_text_sheetMetal', { sheetMetal: results.materials.sheetMetalM2.toFixed(2), insulation: results.materials.insulationM2.toFixed(2) })}

=======================================

${t('report_text_thermalLoads_section')}
${t('report_text_peopleLoad', { value: results.loads.peopleW.toFixed(0) })}
${t('report_text_windowsLoad', { value: results.loads.windowsW.toFixed(0) })}
${t('report_text_lightingLoad', { value: results.loads.lightingW.toFixed(0) })}
${t('report_text_appliancesLoad', { value: results.loads.appliancesW.toFixed(0) })}
${t('report_text_wallsCeilingLoad', { value: results.loads.wallsAndCeilingW.toFixed(0) })}
-----------------------------------
${t('report_text_subTotal', { subTotal: results.loads.subTotalW.toFixed(0) })}
${t('report_text_totalLoad_with_safety', { totalLoad: results.loads.totalLoadW.toFixed(0) })}
${t('report_text_inBtu', { btu: results.loads.totalLoadBtu.toFixed(0) })}
${t('report_text_inTons', { tons: results.loads.totalLoadTons.toFixed(2) })}

${t('report_text_ductSizing_section')}
${t('report_text_requiredAirflow', { value: results.airflow.cfm.toFixed(0) })}
${t('report_text_airVelocity', { value: results.airflow.velocityFpm })}
${t('report_text_ductArea', { value: results.ductSizing.areaSqFt.toFixed(3) })}
${t('report_text_circularDuct', { value: results.ductSizing.roundDiameterIn.toFixed(1) })}
${t('report_text_rectDuct', { width: results.ductSizing.rectWidthIn.toFixed(1), height: results.ductSizing.rectHeightIn.toFixed(1) })}

${t('report_text_materials_section')}
${t('report_text_sheetMetalMaterial', { value: results.materials.sheetMetalM2.toFixed(2) })}
${t('report_text_insulation', { value: results.materials.insulationM2.toFixed(2) })}
${t('report_text_flanges', { flanges: results.materials.flanges })}
${t('report_text_screws', { screws: results.materials.screws })}

${t('report_text_inputs_section')}
${t('report_text_roomDims', { l: getNum(inputs.room.length), w: getNum(inputs.room.width), h: getNum(inputs.room.height) })}
${t('report_text_peopleCount', { count: getNum(inputs.people.count), activity })}
${t('report_text_windowArea', { area: getNum(inputs.windows.area), direction })}
${t('report_text_lightingWattage', { value: getNum(inputs.lighting.wattage) })}
${t('report_text_applianceWattage', { value: getNum(inputs.appliances.wattage) })}
${t('report_text_outdoorTemp', { temp: getNum(inputs.environment.outdoorTemp) })}
${t('report_text_indoorTemp', { temp: getNum(inputs.environment.indoorTemp) })}

${t('report_text_notes_section')}
${t('report_text_note1')}
${t('report_text_note2')}
${t('report_text_note3')}
${t('report_text_note4')}
`;
};

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
  const [inputs, setInputs] = useState<InputState>(initialInputs);
  const [results, setResults] = useState<ResultsState | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [copyButtonText, setCopyButtonText] = useState('copyResults');
  const { t } = useLanguage();

  const STEPS = useMemo(() => [
    { number: 1, title: t('calculator_steps_1'), icon: <BuildingIcon /> },
    { number: 2, title: t('calculator_steps_2'), icon: <UsersIcon /> },
    { number: 3, title: t('calculator_steps_3'), icon: <WindowIcon /> },
    { number: 4, title: t('calculator_steps_4'), icon: <PlugIcon /> },
    { number: 5, title: t('calculator_steps_5'), icon: <ThermometerIcon className="h-6 w-6" /> },
    { number: 6, title: t('calculator_steps_6'), icon: <DocumentReportIcon /> }
  ], [t]);


  useEffect(() => {
    if (activeProject) {
      setInputs(activeProject.inputs);
      setResults(activeProject.results);
      setCurrentStep(6);
    } else {
      setInputs(initialInputs);
      setResults(null);
      setCurrentStep(1);
    }
  }, [activeProject]);

  const calculateAll = useCallback(() => {
    const getNum = (val: number | '') => val || 0;

    const peopleCount = getNum(inputs.people.count);
    const lightingWattage = getNum(inputs.lighting.wattage);
    const windowArea = getNum(inputs.windows.area);
    const applianceWattage = getNum(inputs.appliances.wattage);
    const wallArea = getNum(inputs.wallsAndCeiling.wallArea);
    const ceilingArea = getNum(inputs.wallsAndCeiling.ceilingArea);
    const outdoorTemp = getNum(inputs.environment.outdoorTemp);
    const indoorTemp = getNum(inputs.environment.indoorTemp);
    const tempDifference = Math.max(0, outdoorTemp - indoorTemp);

    const peopleLoadW = HEAT_GAIN_PERSON_WATT[inputs.people.activity] * peopleCount;
    const windowUValue = U_VALUE_WINDOW_W_M2K[inputs.windows.glassType];
    const windowConductionLoadW = windowUValue * windowArea * tempDifference;
    let solarRadiation = SOLAR_RADIATION_W_M2[inputs.windows.direction];
    if (inputs.windows.shading) {
      solarRadiation *= 0.5;
    }
    const windowSolarLoadW = solarRadiation * windowArea;
    const windowsLoadW = windowConductionLoadW + windowSolarLoadW;
    const lightingLoadW = lightingWattage;
    const appliancesLoadW = applianceWattage;
    const insulationUValue = U_VALUE_INSULATION_W_M2K[inputs.wallsAndCeiling.insulationType];
    const wallsAndCeilingLoadW = insulationUValue * (wallArea + ceilingArea) * tempDifference;

    const subTotalW = peopleLoadW + windowsLoadW + lightingLoadW + appliancesLoadW + wallsAndCeilingLoadW;
    const totalLoadW = subTotalW * SAFETY_FACTOR;
    const totalLoadBtu = totalLoadW * WATT_TO_BTU_FACTOR;
    const totalLoadTons = totalLoadW / WATT_TO_TON_FACTOR;

    const cfm = totalLoadTons * CFM_PER_TON;
    const ductAreaSqFt = cfm > 0 ? cfm / DUCT_AIR_VELOCITY : 0;
    const ductAreaSqIn = ductAreaSqFt * 144;
    const roundDiameterIn = Math.sqrt((4 * ductAreaSqIn) / Math.PI);
    const rectHeightIn = Math.sqrt(ductAreaSqIn / 2);
    const rectWidthIn = 2 * rectHeightIn;

    const ductPerimeterM = 2 * (rectWidthIn + rectHeightIn) * INCH_TO_M;
    const sheetMetalM2 = ductPerimeterM * 10;
    const insulationM2 = sheetMetalM2;
    const flanges = 10;
    const screws = 200;

    const newResults: ResultsState = {
      loads: {
        peopleW: peopleLoadW, windowsW: windowsLoadW, lightingW: lightingLoadW,
        appliancesW: appliancesLoadW, wallsAndCeilingW: wallsAndCeilingLoadW,
        subTotalW, totalLoadW, totalLoadBtu, totalLoadTons
      },
      airflow: { cfm, velocityFpm: DUCT_AIR_VELOCITY },
      ductSizing: { areaSqFt: ductAreaSqFt, roundDiameterIn, rectWidthIn, rectHeightIn },
      materials: { sheetMetalM2, insulationM2, flanges, screws }
    };
    setResults(newResults);
    return newResults;
  }, [inputs]);

  const handleInputChange = <T extends Exclude<keyof InputState, 'projectName'>>(section: T, field: keyof InputState[T], value: any) => {
    const processedValue = typeof value === 'number' && isNaN(value) ? '' : value;
    setInputs(prev => ({ ...prev, [section]: { ...prev[section], [field]: processedValue } }));
  };
  
  const handleProjectNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputs(prev => ({...prev, projectName: e.target.value}));
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

  const handleCopyResults = () => {
    if (results) {
      const textToCopy = formatResultsForText(inputs, results, t);
      navigator.clipboard.writeText(textToCopy).then(() => {
        setCopyButtonText('copied');
        setTimeout(() => setCopyButtonText('copyResults'), 2000);
      }).catch(err => {
        console.error('Failed to copy text: ', err);
      });
    }
  };

  const handleDownloadReport = () => {
    if (results) {
      const textToDownload = formatResultsForText(inputs, results, t);
      const blob = new Blob([textToDownload], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${inputs.projectName.replace(/\s+/g, '_') || 'hvac'}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleNext = () => { if (currentStep < 6) setCurrentStep(s => s + 1); };
  const handleBack = () => { if (currentStep > 1) setCurrentStep(s => s - 1); };
  const handleCalculate = () => { calculateAll(); setCurrentStep(6); };
  
  return (
    <div className="bg-gray-900 text-white min-h-screen p-4 sm:p-6 lg:p-8" style={{ fontFamily: 'Cairo, sans-serif' }}>
       <header className="flex justify-between items-center mb-8">
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
        <div className="mb-12">
            <div className="flex items-start justify-between">
                {STEPS.map((step, index) => (
                    <React.Fragment key={step.number}>
                        <div className="flex flex-col items-center text-center w-20">
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

        <div className="bg-gray-800 p-6 sm:p-8 rounded-lg min-h-[400px] flex flex-col justify-between">
            {currentStep === 1 && (
                <div>
                    {/* Fix: Use a unique translation key for the calculator step title to avoid conflicts. */}
                    <h2 className="text-2xl font-bold mb-6 flex items-center"><FolderIcon />{t('calculator_step_title_1')}</h2>
                    <div className="space-y-4">
                         <InputGroup label={t('projectName')} type="text" value={inputs.projectName} onChange={handleProjectNameChange} placeholder={t('projectName_placeholder')}/>
                        <hr className="border-gray-700"/>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <InputGroup label={t('roomLength')} type="number" value={inputs.room.length} onChange={e => handleInputChange('room', 'length', parseFloat(e.target.value))} placeholder="6" />
                            <InputGroup label={t('roomWidth')} type="number" value={inputs.room.width} onChange={e => handleInputChange('room', 'width', parseFloat(e.target.value))} placeholder="5" />
                            <InputGroup label={t('roomHeight')} type="number" value={inputs.room.height} onChange={e => handleInputChange('room', 'height', parseFloat(e.target.value))} placeholder="3" />
                        </div>
                    </div>
                </div>
            )}
            {currentStep === 2 && (
                 <div>
                    {/* Fix: Use a unique translation key for the calculator step title to avoid conflicts. */}
                    <h2 className="text-2xl font-bold mb-6 flex items-center"><UsersIcon />{t('calculator_step_title_2')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-cyan-400">{t('people')}</h3>
                            <InputGroup label={t('peopleCount')} type="number" value={inputs.people.count} onChange={e => handleInputChange('people', 'count', parseInt(e.target.value, 10))} placeholder="5" />
                            <SelectGroup label={t('activityLevel')} value={inputs.people.activity} onChange={e => handleInputChange('people', 'activity', e.target.value)} options={[{value: 'sitting', label: t('activity_sitting')}, {value: 'light_work', label: t('activity_light_work')}, {value: 'heavy_work', label: t('activity_heavy_work')}]}/>
                        </div>
                         <div className="space-y-4">
                             <h3 className="text-lg font-semibold text-cyan-400">{t('lighting')}</h3>
                            <InputGroup label={t('totalLightingPower')} type="number" value={inputs.lighting.wattage} onChange={e => handleInputChange('lighting', 'wattage', parseFloat(e.target.value))} placeholder="300" />
                        </div>
                    </div>
                </div>
            )}
             {currentStep === 3 && (
                 <div>
                    {/* Fix: Use a unique translation key for the calculator step title to avoid conflicts. */}
                    <h2 className="text-2xl font-bold mb-6 flex items-center"><WindowIcon />{t('calculator_step_title_3')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <InputGroup label={t('windowArea')} type="number" value={inputs.windows.area} onChange={e => handleInputChange('windows', 'area', parseFloat(e.target.value))} placeholder="4" />
                             <SelectGroup label={t('glassType')} value={inputs.windows.glassType} onChange={e => handleInputChange('windows', 'glassType', e.target.value)} options={[{value: 'single', label: t('glass_single')}, {value: 'double', label: t('glass_double')}, {value: 'low_e', label: t('glass_low_e')}]}/>
                        </div>
                        <div className="space-y-4">
                            <SelectGroup label={t('windowDirection')} value={inputs.windows.direction} onChange={e => handleInputChange('windows', 'direction', e.target.value)} options={[{value: 'north', label: t('direction_north')}, {value: 'south', label: t('direction_south')}, {value: 'east', label: t('direction_east')}, {value: 'west', label: t('direction_west')}]}/>
                            <ToggleGroup label={t('shading')} enabled={inputs.windows.shading} onToggle={val => handleInputChange('windows', 'shading', val)} />
                        </div>
                    </div>
                </div>
            )}
            {currentStep === 4 && (
                 <div>
                    {/* Fix: Use a unique translation key for the calculator step title to avoid conflicts. */}
                    <h2 className="text-2xl font-bold mb-6 flex items-center"><PlugIcon />{t('calculator_step_title_4')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-cyan-400">{t('appliances')}</h3>
                            <InputGroup label={t('totalAppliancePower')} type="number" value={inputs.appliances.wattage} onChange={e => handleInputChange('appliances', 'wattage', parseFloat(e.target.value))} placeholder="800" />
                        </div>
                        <div className="space-y-4">
                             <h3 className="text-lg font-semibold text-cyan-400">{t('insulation')}</h3>
                            <InputGroup label={t('wallArea')} type="number" value={inputs.wallsAndCeiling.wallArea} onChange={e => handleInputChange('wallsAndCeiling', 'wallArea', parseFloat(e.target.value))} placeholder="66" />
                            <InputGroup label={t('ceilingArea')} type="number" value={inputs.wallsAndCeiling.ceilingArea} onChange={e => handleInputChange('wallsAndCeiling', 'ceilingArea', parseFloat(e.target.value))} placeholder="30" />
                             <SelectGroup label={t('insulationType')} value={inputs.wallsAndCeiling.insulationType} onChange={e => handleInputChange('wallsAndCeiling', 'insulationType', e.target.value)} options={[{value: 'none', label: t('insulation_none')}, {value: 'standard', label: t('insulation_standard')}, {value: 'high', label: t('insulation_high')}]}/>
                        </div>
                    </div>
                </div>
            )}
            {currentStep === 5 && (
                 <div>
                    <h2 className="text-2xl font-bold mb-6 flex items-center"><ThermometerIcon className="h-6 w-6 ltr:mr-2 rtl:ml-2 text-cyan-400" />{t('step5_title')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <InputGroup label={t('outdoorTemp')} type="number" value={inputs.environment.outdoorTemp} onChange={e => handleInputChange('environment', 'outdoorTemp', parseFloat(e.target.value))} placeholder="48" />
                            <InputGroup label={t('indoorTemp')} type="number" value={inputs.environment.indoorTemp} onChange={e => handleInputChange('environment', 'indoorTemp', parseFloat(e.target.value))} placeholder="24" />
                        </div>
                         <div className="space-y-4">
                            <SelectGroup label={t('buildingType')} value={inputs.environment.buildingType} onChange={e => handleInputChange('environment', 'buildingType', e.target.value)} options={[{value: 'residential', label: t('building_residential')}, {value: 'commercial', label: t('building_commercial')}, {value: 'industrial', label: t('building_industrial')}]}/>
                        </div>
                    </div>
                </div>
            )}
            {currentStep === 6 && results && <ReportComponent inputs={inputs} results={results} handleCopy={handleCopyResults} handleDownload={handleDownloadReport} handlePrint={handlePrint} copyText={t(copyButtonText)} />}

            <div className="mt-8 pt-6 border-t border-gray-700 flex justify-between items-center">
                <div>{currentStep > 1 && <button onClick={handleBack} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded transition-colors">{t('back')}</button>}</div>
                <div>
                    {currentStep < 5 && <button onClick={handleNext} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-6 rounded transition-colors">{t('next')}</button>}
                    {currentStep === 5 && <button onClick={handleCalculate} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-lg shadow-lg">{t('calculateNow')}</button>}
                    {currentStep === 6 && <button onClick={handleSaveClick} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded transition-colors">{t('temporarySave')}</button>}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

// Helper Input Components
const InputGroup: React.FC<{label: string; type: string; value: number | string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; step?: string; placeholder?: string;}> = ({ label, type, value, onChange, step, placeholder }) => (
  <div>
    <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
    <input type={type} value={value} onChange={onChange} min="0" step={step} placeholder={placeholder} className="w-full bg-gray-700 p-2 rounded border border-gray-600 focus:ring-cyan-500 focus:border-cyan-500" />
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
const ToggleGroup: React.FC<{label: string, enabled: boolean, onToggle: (enabled: boolean) => void}> = ({ label, enabled, onToggle }) => (
    <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
        <button
            type="button"
            className={`${enabled ? 'bg-cyan-600' : 'bg-gray-600'} relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 focus:ring-offset-gray-800`}
            onClick={() => onToggle(!enabled)}
        >
            <span className={`${enabled ? 'ltr:translate-x-6 rtl:translate-x-1' : 'translate-x-1'} inline-block w-4 h-4 transform bg-white rounded-full transition-transform`} />
        </button>
    </div>
);


// Logo for printing
const EmaarLogo = () => (
    <div className="flex items-center gap-2" dir="ltr">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-cyan-600">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="text-xl font-bold text-gray-800">Emaar<span className="font-normal text-gray-500">HVAC</span></span>
    </div>
);

// Report Components
const ReportComponent: React.FC<{inputs: InputState, results: ResultsState, handleCopy: () => void, handleDownload: () => void, handlePrint: () => void, copyText: string}> = ({inputs, results, handleCopy, handleDownload, handlePrint, copyText}) => {
  const { language, t } = useLanguage();
  const getNum = (val: number | '') => val || 0;
  const locale = language === 'ar' ? 'ar-EG' : 'en-US';

  return (
    <div id="print-section" className="print:bg-white print:text-black print:p-4">
        {/* --- PRINT HEADER --- */}
        <div className="hidden print:flex justify-between items-center mb-6 pb-4 border-b border-gray-400">
            <EmaarLogo />
            <div className="text-right">
                <h1 className="text-xl font-bold">{t('print_header_title', { projectName: inputs.projectName })}</h1>
                <p className="text-sm text-gray-600">{t('print_header_date', { date: new Date().toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' }) })}</p>
            </div>
        </div>

      <div className="flex flex-wrap justify-between items-center mb-6 gap-4 print:hidden">
          <h2 className="text-3xl font-bold text-white print:text-black">
              {t('report_title')} <span className="text-cyan-400">{inputs.projectName}</span>
          </h2>
          <div className="flex gap-2 flex-wrap print:hidden">
              <button onClick={handleCopy} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition-colors flex items-center"><ClipboardIcon />{copyText}</button>
              <button onClick={handleDownload} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition-colors flex items-center"><DownloadIcon />{t('download')}</button>
              <button onClick={handlePrint} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded transition-colors flex items-center"><PrintIcon />{t('print')}</button>
          </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard title={t('totalLoad')} value={`${results.loads.totalLoadW.toLocaleString(locale, {maximumFractionDigits: 0})} W`} subtitle={`${results.loads.totalLoadTons.toFixed(2)} ${t('refrigerationTon')}`} />
        <SummaryCard title={t('airflow')} value={`${results.airflow.cfm.toFixed(0)} ${t('cfm')}`} subtitle={`${t('speed')}: ${results.airflow.velocityFpm} ft/min`} />
        <SummaryCard title={t('ductDiameter')} value={`${results.ductSizing.roundDiameterIn.toFixed(1)}"`} subtitle={t('circular')} />
        {/* Fix: Use a unique translation key for the insulation label to avoid conflicts. */}
        <SummaryCard title={t('sheetMetalRequired')} value={`${results.materials.sheetMetalM2.toFixed(2)} m²`} subtitle={`${t('insulation_summary')}: ${results.materials.insulationM2.toFixed(2)} m²`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 bg-gray-900 print:bg-gray-100 p-4 rounded-lg">
          <div className="lg:col-span-3 space-y-6">
              <DetailSection title={t('thermalLoads')}>
                  <DetailRow label={t('peopleLoad')} value={results.loads.peopleW.toFixed(0)} unit="W" />
                  <DetailRow label={t('windowsLoad')} value={results.loads.windowsW.toFixed(0)} unit="W" />
                  <DetailRow label={t('lightingLoad')} value={results.loads.lightingW.toFixed(0)} unit="W" />
                  <DetailRow label={t('appliancesLoad')} value={results.loads.appliancesW.toFixed(0)} unit="W" />
                  {/* FIX: Corrected typo from wallsCeilingW to wallsAndCeilingW */}
                  <DetailRow label={t('wallsCeilingLoad')} value={results.loads.wallsAndCeilingW.toFixed(0)} unit="W" />
                  <hr className="border-gray-700 print:border-gray-400 my-2"/>
                  <DetailRow label={t('totalLoadWithSafety')} value={results.loads.totalLoadW.toFixed(0)} unit="W" isTotal={true}/>
                  <DetailRow label={t('inBtuHr')} value={results.loads.totalLoadBtu.toFixed(0)} unit="BTU/hr" />
                  <DetailRow label={t('inTons')} value={results.loads.totalLoadTons.toFixed(2)} unit={t('tons')} />
              </DetailSection>
              <DetailSection title={t('ductSizing')}>
                <DetailRow label={t('requiredAirflow')} value={results.airflow.cfm.toFixed(0)} unit={t('cfm')} />
                <DetailRow label={t('airVelocity')} value={results.airflow.velocityFpm.toString()} unit="ft/min" />
                <DetailRow label={t('ductArea')} value={results.ductSizing.areaSqFt.toFixed(4)} unit="ft²" />
                <DetailRow label={t('circularDuctDiameter')} value={results.ductSizing.roundDiameterIn.toFixed(1)} unit={t('inch')} />
                <DetailRow label={t('rectangularDuctWidth')} value={results.ductSizing.rectWidthIn.toFixed(1)} unit={t('inch')} />
                <DetailRow label={t('rectangularDuctHeight')} value={results.ductSizing.rectHeightIn.toFixed(1)} unit={t('inch')} />
              </DetailSection>
              <DetailSection title={t('materialQuantities')}>
                <DetailRow label={t('sheetMetal')} value={results.materials.sheetMetalM2.toFixed(2)} unit="m²" />
                <DetailRow label={t('insulationMaterial')} value={results.materials.insulationM2.toFixed(2)} unit="m²" />
                <DetailRow label={t('flanges')} value={results.materials.flanges.toString()} unit="" />
                <DetailRow label={t('screws')} value={results.materials.screws.toString()} unit="" />
              </DetailSection>
          </div>
          <div className="lg:col-span-2 space-y-6">
              <DetailSection title={t('inputsUsed')}>
                <DetailRow label={t('roomDimensions')} value={`${getNum(inputs.room.length)} × ${getNum(inputs.room.width)} × ${getNum(inputs.room.height)}`} unit="m" />
                <DetailRow label={t('peopleCount')} value={getNum(inputs.people.count).toString()} />
                <DetailRow label={t('windowAreaLabel')} value={getNum(inputs.windows.area).toString()} unit="m²" />
                <DetailRow label={t('lightingPower')} value={getNum(inputs.lighting.wattage).toString()} unit="W" />
                <DetailRow label={t('appliancePower')} value={getNum(inputs.appliances.wattage).toString()} unit="W" />
                <DetailRow label={t('outdoorTemp')} value={getNum(inputs.environment.outdoorTemp).toString()} unit="°C" />
                <DetailRow label={t('indoorTemp')} value={getNum(inputs.environment.indoorTemp).toString()} unit="°C" />
              </DetailSection>
              <DetailSection title={t('importantNotes')}>
                <ul className="space-y-2 text-gray-300 print:text-gray-700 text-sm">
                  <li>{t('note1')}</li>
                  <li>{t('note2')}</li>
                  <li>{t('note3')}</li>
                  <li>{t('note4')}</li>
                  <li>{t('note5')}</li>
                </ul>
              </DetailSection>
          </div>
      </div>

       {/* --- PRINT FOOTER --- */}
       <div className="hidden print:block text-center mt-8 pt-4 border-t border-gray-400 text-xs text-gray-500">
            <p>{t('print_footer_text1')}</p>
            <p>{t('print_footer_text2')}</p>
        </div>
    </div>
  );
};

const SummaryCard: React.FC<{title: string; value: string; subtitle: string}> = ({title, value, subtitle}) => (
  <div className="bg-gray-700/50 print:border print:border-gray-200 p-4 rounded-lg text-center">
    <p className="text-sm text-gray-400 print:text-gray-500">{title}</p>
    <p className="text-2xl font-bold text-white print:text-black my-1">{value}</p>
    <p className="text-xs text-cyan-400 print:text-cyan-600">{subtitle}</p>
  </div>
);
const DetailSection: React.FC<{title: string; children: React.ReactNode}> = ({ title, children }) => (
  <div className="print:mb-4">
    <h3 className="text-xl font-bold text-cyan-400 mb-3 border-b-2 border-cyan-400/30 pb-2 print:text-cyan-700 print:border-gray-300">{title}</h3>
    <div className="space-y-2">{children}</div>
  </div>
);
const DetailRow: React.FC<{label: string; value: string; unit?: string; isTotal?: boolean}> = ({ label, value, unit, isTotal=false}) => (
  <div className={`flex justify-between items-baseline text-sm ${isTotal ? 'text-base font-bold text-yellow-300 print:text-blue-800' : 'text-gray-300 print:text-gray-800'}`}>
    <span>{label}</span>
    <span className="font-mono text-white print:text-black">{value} <span className="text-xs text-gray-400 print:text-gray-500">{unit}</span></span>
  </div>
);

export default CalculatorPage;