import React, { useState, useEffect, useCallback } from 'react';
import type { InputState, ResultsState, Project } from './types';
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

const STEPS = [
    { number: 1, title: "المشروع والغرفة", icon: <BuildingIcon /> },
    { number: 2, title: "الأشخاص والإضاءة", icon: <UsersIcon /> },
    { number: 3, title: "النوافذ", icon: <WindowIcon /> },
    { number: 4, title: "الأجهزة والعزل", icon: <PlugIcon /> },
    { number: 5, title: "البيئة", icon: <ThermometerIcon className="h-6 w-6" /> },
    { number: 6, title: "التقرير الشامل", icon: <DocumentReportIcon /> }
];

interface CalculatorPageProps {
  onNavigate: (page: 'home' | 'projects') => void;
  onSaveProject: (inputs: InputState, results: ResultsState) => void;
  activeProject: Project | null;
}

const formatResultsForText = (inputs: InputState, results: ResultsState): string => {
  const getNum = (val: number | '') => val || 0;

  return `
تقرير حساب الأحمال الحرارية - Emaar HVAC
=======================================
اسم المشروع: ${inputs.projectName || 'غير مسمى'}
تاريخ الإنشاء: ${new Date().toLocaleString('ar-EG')}

--- ملخص النتائج ---
الحمل الكلي: ${results.loads.totalLoadW.toLocaleString('ar-EG', {maximumFractionDigits: 0})} W (${results.loads.totalLoadTons.toFixed(2)} طن)
تدفق الهواء: ${results.airflow.cfm.toFixed(0)} CFM (بسرعة ${results.airflow.velocityFpm} ft/min)
قطر الدكت: ${results.ductSizing.roundDiameterIn.toFixed(1)} بوصة (دائري)
صاج مطلوب: ${results.materials.sheetMetalM2.toFixed(2)} م² (لعازل ${results.materials.insulationM2.toFixed(2)} م²)

=======================================

--- الأحمال الحرارية ---
حمل الأشخاص: ${results.loads.peopleW.toFixed(0)} W
حمل النوافذ: ${results.loads.windowsW.toFixed(0)} W
حمل الإضاءة: ${results.loads.lightingW.toFixed(0)} W
حمل الأجهزة: ${results.loads.appliancesW.toFixed(0)} W
حمل الجدران والسقف: ${results.loads.wallsAndCeilingW.toFixed(0)} W
-----------------------------------
الحمل الكلي (قبل الأمان): ${results.loads.subTotalW.toFixed(0)} W
الحمل الكلي (مع 20% أمان): ${results.loads.totalLoadW.toFixed(0)} W
- بوحدة BTU/hr: ${results.loads.totalLoadBtu.toFixed(0)} BTU/hr
- بوحدة طن تبريد: ${results.loads.totalLoadTons.toFixed(2)} طن

--- مقاسات الدكتات ---
تدفق الهواء المطلوب: ${results.airflow.cfm.toFixed(0)} CFM
سرعة الهواء: ${results.airflow.velocityFpm} ft/min
مساحة الدكت: ${results.ductSizing.areaSqFt.toFixed(3)} ft²
الدكت الدائري (القطر): ${results.ductSizing.roundDiameterIn.toFixed(1)} بوصة
الدكت المستطيل: ${results.ductSizing.rectWidthIn.toFixed(1)} بوصة (عرض) × ${results.ductSizing.rectHeightIn.toFixed(1)} بوصة (ارتفاع)

--- كميات المواد (لـ 10 متر) ---
الصاج: ${results.materials.sheetMetalM2.toFixed(2)} متر مربع
العازل: ${results.materials.insulationM2.toFixed(2)} متر مربع
الفلنجات: ${results.materials.flanges} قطعة
المسامير: ${results.materials.screws} مسمار

--- المدخلات المستخدمة ---
أبعاد الغرفة: ${getNum(inputs.room.length)} × ${getNum(inputs.room.width)} × ${getNum(inputs.room.height)} م
عدد الأشخاص: ${getNum(inputs.people.count)} (${inputs.people.activity})
مساحة النوافذ: ${getNum(inputs.windows.area)} م² (${inputs.windows.direction})
قدرة الإضاءة: ${getNum(inputs.lighting.wattage)} واط
قدرة الأجهزة: ${getNum(inputs.appliances.wattage)} واط
درجة الحرارة الخارجية: ${getNum(inputs.environment.outdoorTemp)}°س
درجة الحرارة الداخلية: ${getNum(inputs.environment.indoorTemp)}°س

--- ملاحظات هامة ---
✓ تم إضافة معامل أمان 20% للحمل الكلي.
✓ الحسابات تعتمد على المعادلات القياسية لحساب أحمال التكييف.
✓ كميات المواد محسوبة لطول 10 متر من الدكت.
✓ يُنصح بمراجعة مهندس تكييف معتمد قبل التنفيذ.
`;
};

const CalculatorPage: React.FC<CalculatorPageProps> = ({ onNavigate, onSaveProject, activeProject }) => {
  const [inputs, setInputs] = useState<InputState>(initialInputs);
  const [results, setResults] = useState<ResultsState | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [copyButtonText, setCopyButtonText] = useState('نسخ النتائج');

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

    // --- Collect Inputs ---
    const peopleCount = getNum(inputs.people.count);
    const lightingWattage = getNum(inputs.lighting.wattage);
    const windowArea = getNum(inputs.windows.area);
    const applianceWattage = getNum(inputs.appliances.wattage);
    const wallArea = getNum(inputs.wallsAndCeiling.wallArea);
    const ceilingArea = getNum(inputs.wallsAndCeiling.ceilingArea);
    const outdoorTemp = getNum(inputs.environment.outdoorTemp);
    const indoorTemp = getNum(inputs.environment.indoorTemp);
    const tempDifference = Math.max(0, outdoorTemp - indoorTemp);

    // --- Heat Loads Calculation (W) - Per PRD ---

    // 1. People Load (FR-3.1)
    const peopleLoadW = HEAT_GAIN_PERSON_WATT[inputs.people.activity] * peopleCount;

    // 2. Window Load (FR-3.2)
    const windowUValue = U_VALUE_WINDOW_W_M2K[inputs.windows.glassType];
    const windowConductionLoadW = windowUValue * windowArea * tempDifference;
    let solarRadiation = SOLAR_RADIATION_W_M2[inputs.windows.direction];
    if (inputs.windows.shading) {
      solarRadiation *= 0.5;
    }
    const windowSolarLoadW = solarRadiation * windowArea;
    const windowsLoadW = windowConductionLoadW + windowSolarLoadW;

    // 3. Lighting Load (FR-3.3)
    const lightingLoadW = lightingWattage;

    // 4. Appliance Load (FR-3.4)
    const appliancesLoadW = applianceWattage;
    
    // 5. Walls & Ceiling Load (FR-3.5)
    const insulationUValue = U_VALUE_INSULATION_W_M2K[inputs.wallsAndCeiling.insulationType];
    const wallsAndCeilingLoadW = insulationUValue * (wallArea + ceilingArea) * tempDifference;

    // 6. Totals (FR-3.6, FR-3.7)
    const subTotalW = peopleLoadW + windowsLoadW + lightingLoadW + appliancesLoadW + wallsAndCeilingLoadW;
    const totalLoadW = subTotalW * SAFETY_FACTOR;
    const totalLoadBtu = totalLoadW * WATT_TO_BTU_FACTOR;
    const totalLoadTons = totalLoadW / WATT_TO_TON_FACTOR;

    // --- Airflow Calculation (FR-3.8) ---
    const cfm = totalLoadTons * CFM_PER_TON;
    
    // --- Duct Sizing (FR-3.9) ---
    const ductAreaSqFt = cfm > 0 ? cfm / DUCT_AIR_VELOCITY : 0;
    const ductAreaSqIn = ductAreaSqFt * 144;
    const roundDiameterIn = Math.sqrt((4 * ductAreaSqIn) / Math.PI);
    const rectHeightIn = Math.sqrt(ductAreaSqIn / 2); // 2:1 Aspect Ratio
    const rectWidthIn = 2 * rectHeightIn;

    // --- Material Quantities (FR-3.10 for 10m length) ---
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

  // Fix: Constrain the generic type T to exclude 'projectName'.
  // This ensures that 'section' is always a key pointing to an object in InputState,
  // preventing a "spread types may only be created from object types" error on `...prev[section]`.
  const handleInputChange = <T extends Exclude<keyof InputState, 'projectName'>>(section: T, field: keyof InputState[T], value: any) => {
    const processedValue = typeof value === 'number' && isNaN(value) ? '' : value;
    setInputs(prev => ({ ...prev, [section]: { ...prev[section], [field]: processedValue } }));
  };
  
  const handleProjectNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputs(prev => ({...prev, projectName: e.target.value}));
  };

  const handleSaveClick = () => {
    if (!inputs.projectName) { alert("يرجى إدخال اسم للمشروع قبل الحفظ."); return; }
    if (results) onSaveProject(inputs, results);
    else {
      const calculatedResults = calculateAll();
      if(calculatedResults) onSaveProject(inputs, calculatedResults);
      else alert("لا يمكن حفظ المشروع قبل حساب النتائج.");
    }
  };

  const handlePrint = () => { window.print(); };

  const handleCopyResults = () => {
    if (results) {
      const textToCopy = formatResultsForText(inputs, results);
      navigator.clipboard.writeText(textToCopy).then(() => {
        setCopyButtonText('تم النسخ!');
        setTimeout(() => setCopyButtonText('نسخ النتائج'), 2000);
      }).catch(err => {
        console.error('Failed to copy text: ', err);
        alert('فشل نسخ النتائج.');
      });
    }
  };

  const handleDownloadReport = () => {
    if (results) {
      const textToDownload = formatResultsForText(inputs, results);
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
                <p className="text-lg text-gray-300 mt-2">الحل المتكامل لحساب الأحمال الحرارية وتصميم أنظمة التكييف</p>
            </div>
             <div className="flex gap-4">
                <button onClick={() => onNavigate('home')} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded transition-colors">
                    → الرئيسية
                </button>
                 <button onClick={() => onNavigate('projects')} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded transition-colors">
                    → المشاريع المحفوظة
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
                    <h2 className="text-2xl font-bold mb-6 flex items-center"><FolderIcon />الخطوة 1: معلومات المشروع والغرفة</h2>
                    <div className="space-y-4">
                         <InputGroup label="اسم المشروع" type="text" value={inputs.projectName} onChange={handleProjectNameChange} placeholder="مثال: فيلا الطابق الأول"/>
                        <hr className="border-gray-700"/>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <InputGroup label="طول الغرفة (متر)" type="number" value={inputs.room.length} onChange={e => handleInputChange('room', 'length', parseFloat(e.target.value))} placeholder="6" />
                            <InputGroup label="عرض الغرفة (متر)" type="number" value={inputs.room.width} onChange={e => handleInputChange('room', 'width', parseFloat(e.target.value))} placeholder="5" />
                            <InputGroup label="ارتفاع الغرفة (متر)" type="number" value={inputs.room.height} onChange={e => handleInputChange('room', 'height', parseFloat(e.target.value))} placeholder="3" />
                        </div>
                    </div>
                </div>
            )}
            {currentStep === 2 && (
                 <div>
                    <h2 className="text-2xl font-bold mb-6 flex items-center"><UsersIcon />الخطوة 2: الأشخاص والإضاءة</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-cyan-400">الأشخاص</h3>
                            <InputGroup label="عدد الأشخاص" type="number" value={inputs.people.count} onChange={e => handleInputChange('people', 'count', parseInt(e.target.value, 10))} placeholder="5" />
                            <SelectGroup label="مستوى النشاط" value={inputs.people.activity} onChange={e => handleInputChange('people', 'activity', e.target.value)} options={[{value: 'sitting', label: 'جلوس'}, {value: 'light_work', label: 'عمل خفيف'}, {value: 'heavy_work', label: 'عمل شاق'}]}/>
                        </div>
                         <div className="space-y-4">
                             <h3 className="text-lg font-semibold text-cyan-400">الإضاءة</h3>
                            <InputGroup label="قدرة الإضاءة الكلية (واط)" type="number" value={inputs.lighting.wattage} onChange={e => handleInputChange('lighting', 'wattage', parseFloat(e.target.value))} placeholder="300" />
                        </div>
                    </div>
                </div>
            )}
             {currentStep === 3 && (
                 <div>
                    <h2 className="text-2xl font-bold mb-6 flex items-center"><WindowIcon />الخطوة 3: النوافذ</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <InputGroup label="مساحة النوافذ (متر مربع)" type="number" value={inputs.windows.area} onChange={e => handleInputChange('windows', 'area', parseFloat(e.target.value))} placeholder="4" />
                             <SelectGroup label="نوع الزجاج" value={inputs.windows.glassType} onChange={e => handleInputChange('windows', 'glassType', e.target.value)} options={[{value: 'single', label: 'مفرد'}, {value: 'double', label: 'مزدوج'}, {value: 'low_e', label: 'Low-E'}]}/>
                        </div>
                        <div className="space-y-4">
                            <SelectGroup label="اتجاه النافذة" value={inputs.windows.direction} onChange={e => handleInputChange('windows', 'direction', e.target.value)} options={[{value: 'north', label: 'شمال'}, {value: 'south', label: 'جنوب'}, {value: 'east', label: 'شرق'}, {value: 'west', label: 'غرب'}]}/>
                            <ToggleGroup label="وجود ظل/ستائر" enabled={inputs.windows.shading} onToggle={val => handleInputChange('windows', 'shading', val)} />
                        </div>
                    </div>
                </div>
            )}
            {currentStep === 4 && (
                 <div>
                    <h2 className="text-2xl font-bold mb-6 flex items-center"><PlugIcon />الخطوة 4: الأجهزة والعزل</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-cyan-400">الأجهزة</h3>
                            <InputGroup label="قدرة الأجهزة الكلية (واط)" type="number" value={inputs.appliances.wattage} onChange={e => handleInputChange('appliances', 'wattage', parseFloat(e.target.value))} placeholder="800" />
                        </div>
                        <div className="space-y-4">
                             <h3 className="text-lg font-semibold text-cyan-400">العزل</h3>
                            <InputGroup label="مساحة الجدران (متر مربع)" type="number" value={inputs.wallsAndCeiling.wallArea} onChange={e => handleInputChange('wallsAndCeiling', 'wallArea', parseFloat(e.target.value))} placeholder="66" />
                            <InputGroup label="مساحة السقف (متر مربع)" type="number" value={inputs.wallsAndCeiling.ceilingArea} onChange={e => handleInputChange('wallsAndCeiling', 'ceilingArea', parseFloat(e.target.value))} placeholder="30" />
                             <SelectGroup label="نوع العزل" value={inputs.wallsAndCeiling.insulationType} onChange={e => handleInputChange('wallsAndCeiling', 'insulationType', e.target.value)} options={[{value: 'none', label: 'بدون عزل'}, {value: 'standard', label: 'قياسي'}, {value: 'high', label: 'عالي'}]}/>
                        </div>
                    </div>
                </div>
            )}
            {currentStep === 5 && (
                 <div>
                    <h2 className="text-2xl font-bold mb-6 flex items-center"><ThermometerIcon className="h-6 w-6 mr-2 text-cyan-400" />الخطوة 5: البيئة</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <InputGroup label="درجة الحرارة الخارجية (°مئوية)" type="number" value={inputs.environment.outdoorTemp} onChange={e => handleInputChange('environment', 'outdoorTemp', parseFloat(e.target.value))} placeholder="48" />
                            <InputGroup label="درجة الحرارة الداخلية المطلوبة (°مئوية)" type="number" value={inputs.environment.indoorTemp} onChange={e => handleInputChange('environment', 'indoorTemp', parseFloat(e.target.value))} placeholder="24" />
                        </div>
                         <div className="space-y-4">
                            <SelectGroup label="نوع المبنى" value={inputs.environment.buildingType} onChange={e => handleInputChange('environment', 'buildingType', e.target.value)} options={[{value: 'residential', label: 'سكني'}, {value: 'commercial', label: 'تجاري'}, {value: 'industrial', label: 'صناعي'}]}/>
                        </div>
                    </div>
                </div>
            )}
            {currentStep === 6 && results && <ReportComponent inputs={inputs} results={results} handleCopy={handleCopyResults} handleDownload={handleDownloadReport} handlePrint={handlePrint} copyText={copyButtonText} />}

            <div className="mt-8 pt-6 border-t border-gray-700 flex justify-between items-center">
                <div>{currentStep > 1 && <button onClick={handleBack} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded transition-colors">السابق</button>}</div>
                <div>
                    {currentStep < 5 && <button onClick={handleNext} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-6 rounded transition-colors">التالي</button>}
                    {currentStep === 5 && <button onClick={handleCalculate} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-lg shadow-lg">احسب الآن</button>}
                    {currentStep === 6 && <button onClick={handleSaveClick} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded transition-colors">حفظ مؤقت</button>}
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
            <span className={`${enabled ? 'translate-x-6' : 'translate-x-1'} inline-block w-4 h-4 transform bg-white rounded-full transition-transform`} />
        </button>
    </div>
);


// Report Components
const ReportComponent: React.FC<{inputs: InputState, results: ResultsState, handleCopy: () => void, handleDownload: () => void, handlePrint: () => void, copyText: string}> = ({inputs, results, handleCopy, handleDownload, handlePrint, copyText}) => {
  const getNum = (val: number | '') => val || 0;

  return (
    <div id="print-section" className="print:bg-white print:text-black print:p-4">
      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
          <h2 className="text-3xl font-bold text-white print:text-black">
              تقرير المشروع: <span className="text-cyan-400">{inputs.projectName}</span>
          </h2>
          <div className="flex gap-2 flex-wrap print:hidden">
              <button onClick={handleCopy} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition-colors flex items-center"><ClipboardIcon />{copyText}</button>
              <button onClick={handleDownload} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition-colors flex items-center"><DownloadIcon />تحميل</button>
              <button onClick={handlePrint} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded transition-colors flex items-center"><PrintIcon />طباعة</button>
          </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard title="الحمل الكلي" value={`${results.loads.totalLoadW.toLocaleString('ar-EG', {maximumFractionDigits: 0})} W`} subtitle={`${results.loads.totalLoadTons.toFixed(2)} طن تبريد`} />
        <SummaryCard title="تدفق الهواء" value={`${results.airflow.cfm.toFixed(0)} CFM`} subtitle={`سرعة: ${results.airflow.velocityFpm} ft/min`} />
        <SummaryCard title="قطر الدكت" value={`${results.ductSizing.roundDiameterIn.toFixed(1)}"`} subtitle="دائري" />
        <SummaryCard title="صاج مطلوب" value={`${results.materials.sheetMetalM2.toFixed(2)} م²`} subtitle={`عازل: ${results.materials.insulationM2.toFixed(2)} م²`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 bg-gray-900 print:bg-gray-100 p-4 rounded-lg">
          <div className="lg:col-span-3 space-y-6">
              <DetailSection title="الأحمال الحرارية">
                  <DetailRow label="حمل الأشخاص" value={results.loads.peopleW.toFixed(0)} unit="W" />
                  <DetailRow label="حمل النوافذ" value={results.loads.windowsW.toFixed(0)} unit="W" />
                  <DetailRow label="حمل الإضاءة" value={results.loads.lightingW.toFixed(0)} unit="W" />
                  <DetailRow label="حمل الأجهزة" value={results.loads.appliancesW.toFixed(0)} unit="W" />
                  <DetailRow label="حمل الجدران والسقف" value={results.loads.wallsAndCeilingW.toFixed(0)} unit="W" />
                  <hr className="border-gray-700 print:border-gray-400 my-2"/>
                  <DetailRow label="الحمل الكلي (مع 20% أمان)" value={results.loads.totalLoadW.toFixed(0)} unit="W" isTotal={true}/>
                  <DetailRow label="بوحدة BTU/hr" value={results.loads.totalLoadBtu.toFixed(0)} unit="BTU/hr" />
                  <DetailRow label="بوحدة طن تبريد" value={results.loads.totalLoadTons.toFixed(2)} unit="طن" />
              </DetailSection>
              <DetailSection title="مقاسات الدكتات">
                <DetailRow label="تدفق الهواء المطلوب" value={results.airflow.cfm.toFixed(0)} unit="CFM" />
                <DetailRow label="سرعة الهواء" value={results.airflow.velocityFpm.toString()} unit="ft/min" />
                <DetailRow label="مساحة الدكت" value={results.ductSizing.areaSqFt.toFixed(4)} unit="ft²" />
                <DetailRow label="الدكت الدائري: القطر" value={results.ductSizing.roundDiameterIn.toFixed(1)} unit="بوصة" />
                <DetailRow label="الدكت المستطيل: العرض" value={results.ductSizing.rectWidthIn.toFixed(1)} unit="بوصة" />
                <DetailRow label="الدكت المستطيل: الارتفاع" value={results.ductSizing.rectHeightIn.toFixed(1)} unit="بوصة" />
              </DetailSection>
              <DetailSection title="كميات المواد (لـ 10 متر)">
                <DetailRow label="الصاج" value={results.materials.sheetMetalM2.toFixed(2)} unit="متر مربع" />
                <DetailRow label="العازل" value={results.materials.insulationM2.toFixed(2)} unit="متر مربع" />
                <DetailRow label="الفلنجات" value={results.materials.flanges.toString()} unit="قطعة" />
                <DetailRow label="المسامير" value={results.materials.screws.toString()} unit="مسمار" />
              </DetailSection>
          </div>
          <div className="lg:col-span-2 space-y-6">
              <DetailSection title="المدخلات المستخدمة">
                <DetailRow label="أبعاد الغرفة" value={`${getNum(inputs.room.length)} × ${getNum(inputs.room.width)} × ${getNum(inputs.room.height)}`} unit="م" />
                <DetailRow label="عدد الأشخاص" value={getNum(inputs.people.count).toString()} />
                <DetailRow label="مساحة النوافذ" value={getNum(inputs.windows.area).toString()} unit="م²" />
                <DetailRow label="قدرة الإضاءة" value={getNum(inputs.lighting.wattage).toString()} unit="واط" />
                <DetailRow label="قدرة الأجهزة" value={getNum(inputs.appliances.wattage).toString()} unit="واط" />
                <DetailRow label="درجة الحرارة الخارجية" value={getNum(inputs.environment.outdoorTemp).toString()} unit="°س" />
                <DetailRow label="درجة الحرارة الداخلية" value={getNum(inputs.environment.indoorTemp).toString()} unit="°س" />
              </DetailSection>
              <DetailSection title="ملاحظات هامة">
                <ul className="space-y-2 text-gray-300 print:text-gray-700 text-sm">
                  <li>✓ تم إضافة معامل أمان 20% للحمل الكلي.</li>
                  <li>✓ الحسابات تعتمد على المعادلات القياسية لحساب أحمال التكييف.</li>
                  <li>✓ كميات المواد محسوبة لطول 10 متر من الدكت.</li>
                  <li>✓ يُنصح بمراجعة مهندس تكييف معتمد قبل التنفيذ.</li>
                  <li>✓ قد تختلف الأحمال الفعلية حسب ظروف الموقع الحقيقية.</li>
                </ul>
              </DetailSection>
          </div>
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