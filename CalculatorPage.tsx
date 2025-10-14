import React, { useState, useEffect, useCallback } from 'react';
import type { InputState, ResultsState, Project } from './types';
import { 
  U_VALUE_WALL, U_VALUE_WINDOW, SHGC_WINDOW, SOLAR_FACTOR,
  WATT_TO_BTU_FACTOR, BTU_PER_TON, DUCT_AIR_VELOCITY,
  HEAT_GAIN_PERSON_WATT, SAFETY_FACTOR, CFM_PER_TON,
  FT_TO_M, SQFT_TO_SQM, INCH_TO_M
} from './constants';
import { BuildingIcon, UsersIcon, LightbulbIcon, DocumentReportIcon, FolderIcon, PrintIcon, CheckCircleIcon, ClipboardIcon, DownloadIcon } from './Icons';

const initialInputs: InputState = {
  projectName: '',
  room: { length: '', width: '', height: '', wallType: 'insulated', tempDifference: '' },
  people: { count: '', activity: 'sitting' },
  windows: { count: '', width: '', height: '', type: 'double_pane' },
  lighting: { wattage: '' },
  appliances: { wattage: '' },
  infiltration: { ach: '' },
  ductLength: '', // Note: ductLength from input is no longer used for material calculation
};

const STEPS = [
    { number: 1, title: "المشروع والغرفة", icon: <BuildingIcon /> },
    { number: 2, title: "الأشخاص والنوافذ", icon: <UsersIcon /> },
    { number: 3, title: "الأجهزة والدكتات", icon: <LightbulbIcon /> },
    { number: 4, title: "التقرير الشامل", icon: <DocumentReportIcon /> }
];

interface CalculatorPageProps {
  onNavigate: (page: 'home' | 'projects') => void;
  onSaveProject: (inputs: InputState, results: ResultsState) => void;
  activeProject: Project | null;
}

const formatResultsForText = (inputs: InputState, results: ResultsState): string => {
  const getNum = (val: number | '') => val || 0;
  const roomLengthM = (getNum(inputs.room.length) * FT_TO_M).toFixed(0);
  const roomWidthM = (getNum(inputs.room.width) * FT_TO_M).toFixed(0);
  const roomHeightM = (getNum(inputs.room.height) * FT_TO_M).toFixed(0);
  const windowAreaFt2 = getNum(inputs.windows.count) * getNum(inputs.windows.width) * getNum(inputs.windows.height);
  const windowAreaM2 = (windowAreaFt2 * SQFT_TO_SQM).toFixed(0);

  const indoorTempC = 22;
  const tempDiffC = getNum(inputs.room.tempDifference) / 1.8;
  const outdoorTempC = indoorTempC + tempDiffC;

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
حمل التسريب (تهوية): ${results.loads.infiltrationW.toFixed(0)} W
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
أبعاد الغرفة: ${roomLengthM} × ${roomWidthM} × ${roomHeightM} م
عدد الأشخاص: ${getNum(inputs.people.count)}
مساحة النوافذ: ${windowAreaM2} م²
قدرة الإضاءة: ${getNum(inputs.lighting.wattage)} واط
قدرة الأجهزة: ${getNum(inputs.appliances.wattage)} واط
درجة الحرارة الخارجية: ${outdoorTempC.toFixed(0)}°س
درجة الحرارة الداخلية: ${indoorTempC}°س

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
      setCurrentStep(4);
    } else {
      setInputs(initialInputs);
      setResults(null);
      setCurrentStep(1);
    }
  }, [activeProject]);

  const calculateAll = useCallback(() => {
    const getNum = (val: number | '') => val || 0;

    const roomLength = getNum(inputs.room.length);
    const roomWidth = getNum(inputs.room.width);
    const roomHeight = getNum(inputs.room.height);
    const tempDifference = getNum(inputs.room.tempDifference);
    const peopleCount = getNum(inputs.people.count);
    const windowsCount = getNum(inputs.windows.count);
    const windowWidth = getNum(inputs.windows.width);
    const windowHeight = getNum(inputs.windows.height);
    const lightingWattage = getNum(inputs.lighting.wattage);
    const appliancesWattage = getNum(inputs.appliances.wattage);
    const infiltrationAch = getNum(inputs.infiltration.ach);

    // --- Heat Loads Calculation (in original units, then converted) ---

    // 1. People Load (W) - Direct from PRD
    const peopleLoadW = HEAT_GAIN_PERSON_WATT[inputs.people.activity] * peopleCount;

    // 2. Lighting & Appliances (W) - Direct from inputs
    const lightingLoadW = lightingWattage;
    const appliancesLoadW = appliancesWattage;

    // 3. Walls, Ceiling, Windows (BTU/hr -> W) - Using legacy formulas as inputs haven't changed
    const wallArea = (2 * roomLength * roomHeight) + (2 * roomWidth * roomHeight);
    const ceilingArea = roomLength * roomWidth;
    const windowArea = windowsCount * windowWidth * windowHeight;
    
    const wallsAndCeilingLoadBtu = U_VALUE_WALL[inputs.room.wallType] * (wallArea + ceilingArea - windowArea) * tempDifference;
    const windowConductionLoadBtu = U_VALUE_WINDOW[inputs.windows.type] * windowArea * tempDifference;
    const windowSolarLoadBtu = SHGC_WINDOW[inputs.windows.type] * windowArea * SOLAR_FACTOR;
    
    const wallsAndCeilingLoadW = wallsAndCeilingLoadBtu / WATT_TO_BTU_FACTOR;
    const windowsLoadW = (windowConductionLoadBtu + windowSolarLoadBtu) / WATT_TO_BTU_FACTOR;

    // 4. Infiltration Load (BTU/hr -> W)
    const roomVolume = roomLength * roomWidth * roomHeight;
    const infiltrationCFM = (roomVolume * infiltrationAch) / 60;
    const infiltrationLoadBtu = 1.08 * infiltrationCFM * tempDifference;
    const infiltrationLoadW = infiltrationLoadBtu / WATT_TO_BTU_FACTOR;

    // 5. Totals
    const subTotalW = peopleLoadW + lightingLoadW + appliancesLoadW + wallsAndCeilingLoadW + windowsLoadW + infiltrationLoadW;
    const totalLoadW = subTotalW * SAFETY_FACTOR;
    const totalLoadBtu = totalLoadW * WATT_TO_BTU_FACTOR;
    const totalLoadTons = totalLoadBtu / BTU_PER_TON;

    // --- Airflow Calculation ---
    const cfm = totalLoadTons * CFM_PER_TON;
    
    // --- Duct Sizing ---
    const ductAreaSqFt = cfm > 0 ? cfm / DUCT_AIR_VELOCITY : 0;
    const ductAreaSqIn = ductAreaSqFt * 144;
    const roundDiameterIn = Math.sqrt((4 * ductAreaSqIn) / Math.PI);
    // 2:1 Aspect Ratio for Rectangular Duct
    const rectHeightIn = Math.sqrt(ductAreaSqIn / 2);
    const rectWidthIn = 2 * rectHeightIn;

    // --- Material Quantities (for 10m length) ---
    const ductPerimeterM = 2 * (rectWidthIn + rectHeightIn) * INCH_TO_M;
    const sheetMetalM2 = ductPerimeterM * 10;
    const insulationM2 = sheetMetalM2;
    const flanges = 10; // Per PRD for 10m
    const screws = 200; // Per PRD for 10m

    const newResults: ResultsState = {
      loads: {
        peopleW: peopleLoadW, windowsW: windowsLoadW, lightingW: lightingLoadW,
        appliancesW: appliancesLoadW, wallsAndCeilingW: wallsAndCeilingLoadW,
        infiltrationW: infiltrationLoadW, subTotalW, totalLoadW,
        totalLoadBtu, totalLoadTons
      },
      airflow: { cfm, velocityFpm: DUCT_AIR_VELOCITY },
      ductSizing: { areaSqFt: ductAreaSqFt, roundDiameterIn, rectWidthIn, rectHeightIn },
      materials: { sheetMetalM2, insulationM2, flanges, screws }
    };
    setResults(newResults);
    return newResults;
  }, [inputs]);

  const handleInputChange = <T extends keyof InputState>(section: T, field: keyof InputState[T], value: any) => {
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

  const handleNext = () => { if (currentStep < 4) setCurrentStep(s => s + 1); };
  const handleBack = () => { if (currentStep > 1) setCurrentStep(s => s - 1); };
  const handleCalculate = () => { calculateAll(); setCurrentStep(4); };
  
  // Render function
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
            <div className="flex items-center justify-between">
                {STEPS.map((step, index) => (
                    <React.Fragment key={step.number}>
                        <div className="flex flex-col items-center text-center">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${currentStep >= step.number ? 'bg-cyan-500 border-cyan-500' : 'border-gray-600'}`}>
                                {currentStep > step.number ? <CheckCircleIcon className="w-6 h-6 text-white"/> : <span className="text-lg font-bold">{step.number}</span>}
                            </div>
                            <p className={`mt-2 font-semibold ${currentStep >= step.number ? 'text-cyan-400' : 'text-gray-500'}`}>{step.title}</p>
                        </div>
                        {index < STEPS.length - 1 && <div className={`flex-1 h-1 mx-4 ${currentStep > index + 1 ? 'bg-cyan-500' : 'bg-gray-600'}`}></div>}
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
                            <InputGroup label="الطول (قدم)" type="number" value={inputs.room.length} onChange={e => handleInputChange('room', 'length', parseFloat(e.target.value))} placeholder="20" />
                            <InputGroup label="العرض (قدم)" type="number" value={inputs.room.width} onChange={e => handleInputChange('room', 'width', parseFloat(e.target.value))} placeholder="15" />
                            <InputGroup label="الارتفاع (قدم)" type="number" value={inputs.room.height} onChange={e => handleInputChange('room', 'height', parseFloat(e.target.value))} placeholder="10" />
                            <InputGroup label="فرق الحرارة (°F)" type="number" value={inputs.room.tempDifference} onChange={e => handleInputChange('room', 'tempDifference', parseFloat(e.target.value))} placeholder="20" />
                            <SelectGroup label="نوع الجدار" value={inputs.room.wallType} onChange={e => handleInputChange('room', 'wallType', e.target.value)} options={[{value: 'insulated', label: 'معزول'}, {value: 'not_insulated', label: 'غير معزول'}]}/>
                        </div>
                    </div>
                </div>
            )}
            {currentStep === 2 && (
                 <div>
                    <h2 className="text-2xl font-bold mb-6 flex items-center"><UsersIcon />الخطوة 2: الأشخاص والنوافذ</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-cyan-400">الأشخاص</h3>
                            <InputGroup label="عدد الأشخاص" type="number" value={inputs.people.count} onChange={e => handleInputChange('people', 'count', parseInt(e.target.value, 10))} placeholder="3" />
                            <SelectGroup label="مستوى النشاط" value={inputs.people.activity} onChange={e => handleInputChange('people', 'activity', e.target.value)} options={[{value: 'sitting', label: 'جلوس'}, {value: 'light_work', label: 'عمل خفيف'}]}/>
                        </div>
                         <div className="space-y-4">
                             <h3 className="text-lg font-semibold text-cyan-400">النوافذ</h3>
                            <InputGroup label="عدد النوافذ" type="number" value={inputs.windows.count} onChange={e => handleInputChange('windows', 'count', parseInt(e.target.value, 10))} placeholder="2" />
                            <InputGroup label="عرض النافذة (قدم)" type="number" value={inputs.windows.width} onChange={e => handleInputChange('windows', 'width', parseFloat(e.target.value))} placeholder="4" />
                            <InputGroup label="ارتفاع النافذة (قدم)" type="number" value={inputs.windows.height} onChange={e => handleInputChange('windows', 'height', parseFloat(e.target.value))} placeholder="5" />
                            <SelectGroup label="نوع الزجاج" value={inputs.windows.type} onChange={e => handleInputChange('windows', 'type', e.target.value)} options={[{value: 'single_pane', label: 'مفرد'}, {value: 'double_pane', label: 'مزدوج'}]}/>
                        </div>
                    </div>
                </div>
            )}
             {currentStep === 3 && (
                 <div>
                    <h2 className="text-2xl font-bold mb-6 flex items-center"><LightbulbIcon />الخطوة 3: الإضاءة، الأجهزة، والتهوية</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-cyan-400">الإضاءة والأجهزة</h3>
                            <InputGroup label="إجمالي واط الإضاءة (Watt)" type="number" value={inputs.lighting.wattage} onChange={e => handleInputChange('lighting', 'wattage', parseFloat(e.target.value))} placeholder="300" />
                            <InputGroup label="إجمالي واط الأجهزة (Watt)" type="number" value={inputs.appliances.wattage} onChange={e => handleInputChange('appliances', 'wattage', parseFloat(e.target.value))} placeholder="500" />
                        </div>
                        <div className="space-y-4">
                             <h3 className="text-lg font-semibold text-cyan-400">التهوية (Infiltration)</h3>
                             <InputGroup label="معدل تغير الهواء (ACH)" type="number" step="0.1" value={inputs.infiltration.ach} onChange={e => handleInputChange('infiltration', 'ach', parseFloat(e.target.value))} placeholder="0.5" />
                        </div>
                    </div>
                </div>
            )}
            {currentStep === 4 && results && <ReportComponent inputs={inputs} results={results} handleCopy={handleCopyResults} handleDownload={handleDownloadReport} handlePrint={handlePrint} copyText={copyButtonText} />}

            <div className="mt-8 pt-6 border-t border-gray-700 flex justify-between items-center">
                <div>{currentStep > 1 && <button onClick={handleBack} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded transition-colors">السابق</button>}</div>
                <div>
                    {currentStep < 3 && <button onClick={handleNext} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-6 rounded transition-colors">التالي</button>}
                    {currentStep === 3 && <button onClick={handleCalculate} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-lg shadow-lg">احسب الآن</button>}
                    {currentStep === 4 && <button onClick={handleSaveClick} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded transition-colors">حفظ مؤقت</button>}
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

// Report Components
const ReportComponent: React.FC<{inputs: InputState, results: ResultsState, handleCopy: () => void, handleDownload: () => void, handlePrint: () => void, copyText: string}> = ({inputs, results, handleCopy, handleDownload, handlePrint, copyText}) => {
  const getNum = (val: number | '') => val || 0;
  const roomLengthM = (getNum(inputs.room.length) * FT_TO_M).toFixed(0);
  const roomWidthM = (getNum(inputs.room.width) * FT_TO_M).toFixed(0);
  const roomHeightM = (getNum(inputs.room.height) * FT_TO_M).toFixed(0);
  const windowAreaFt2 = getNum(inputs.windows.count) * getNum(inputs.windows.width) * getNum(inputs.windows.height);
  const windowAreaM2 = (windowAreaFt2 * SQFT_TO_SQM).toFixed(0);
  const indoorTempC = 22;
  const tempDiffC = getNum(inputs.room.tempDifference) / 1.8;
  const outdoorTempC = indoorTempC + tempDiffC;

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
                  <DetailRow label="حمل التسريب (تهوية)" value={results.loads.infiltrationW.toFixed(0)} unit="W" />
                  <hr className="border-gray-700 print:border-gray-400 my-2"/>
                  <DetailRow label="الحمل الكلي" value={results.loads.totalLoadW.toFixed(0)} unit="W" isTotal={true}/>
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
                <DetailRow label="أبعاد الغرفة" value={`${roomLengthM} × ${roomWidthM} × ${roomHeightM}`} unit="م" />
                <DetailRow label="عدد الأشخاص" value={getNum(inputs.people.count).toString()} />
                <DetailRow label="مساحة النوافذ" value={windowAreaM2} unit="م²" />
                <DetailRow label="قدرة الإضاءة" value={getNum(inputs.lighting.wattage).toString()} unit="واط" />
                <DetailRow label="قدرة الأجهزة" value={getNum(inputs.appliances.wattage).toString()} unit="واط" />
                <DetailRow label="درجة الحرارة الخارجية" value={outdoorTempC.toFixed(0)} unit="°س" />
                <DetailRow label="درجة الحرارة الداخلية" value={indoorTempC.toString()} unit="°س" />
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
