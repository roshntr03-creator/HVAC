import React from 'react';
import { ThermometerIcon, WindIcon, RulerIcon, CalculatorIcon, SaveIcon, ReportIcon, ArrowRightIcon } from './Icons';

interface HomePageProps {
  onNavigate: (page: 'calculator' | 'projects') => void;
}

const FeatureCard: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({ icon, title, description }) => (
  <div className="bg-gray-800 p-6 rounded-lg shadow-lg hover:shadow-cyan-500/20 hover:-translate-y-2 transition-all duration-300">
    <div className="flex items-center justify-center h-16 w-16 rounded-full bg-gray-700 mb-4">
      {icon}
    </div>
    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
    <p className="text-gray-400">{description}</p>
  </div>
);

const Step: React.FC<{ number: string; title: string; description: string }> = ({ number, title, description }) => (
  <div className="flex">
    <div className="flex flex-col items-center mr-4">
      <div>
        <div className="flex items-center justify-center w-10 h-10 border-2 border-cyan-400 rounded-full text-cyan-400 font-bold">
          {number}
        </div>
      </div>
      <div className="w-px h-full bg-gray-600"></div>
    </div>
    <div className="pb-8 pt-1">
      <p className="mb-2 text-xl font-bold text-white">{title}</p>
      <p className="text-gray-400">{description}</p>
    </div>
  </div>
);

const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  return (
    <div className="bg-gray-900 text-white" style={{ fontFamily: 'Cairo, sans-serif' }}>
      {/* Hero Section */}
      <div className="relative text-center bg-gray-800 py-20 sm:py-32 overflow-hidden">
         <div className="absolute inset-0 bg-cover bg-center opacity-10" style={{backgroundImage: "url('https://images.unsplash.com/photo-1558017487-957252061266?q=80&w=2070&auto=format&fit=crop')"}}></div>
         <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent"></div>
         <div className="relative z-10 max-w-4xl mx-auto px-4">
            <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight">
                <span className="text-cyan-400">Emaar</span> HVAC
            </h1>
            <p className="mt-4 text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto">
                حساب دقيق للأحمال الحرارية وتصميم أنظمة التكييف
            </p>
            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
                <button 
                    onClick={() => onNavigate('calculator')}
                    className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 px-8 rounded-lg text-lg shadow-lg hover:shadow-cyan-500/40 transform hover:-translate-y-1 transition-all duration-300 flex items-center justify-center"
                >
                    ابدأ حساب جديد
                    <ArrowRightIcon />
                </button>
                 <button 
                    onClick={() => onNavigate('projects')}
                    className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-8 rounded-lg text-lg shadow-lg hover:shadow-gray-600/40 transform hover:-translate-y-1 transition-all duration-300"
                >
                    المشاريع المحفوظة
                </button>
            </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
        {/* Features Section */}
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">المميزات الرئيسية</h2>
            <p className="mt-2 text-lg text-gray-400">كل ما تحتاجه في مكان واحد لحسابات التكييف</p>
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard 
              icon={<ThermometerIcon />}
              title="حساب الأحمال الحرارية" 
              description="حساب دقيق للأحمال من الأشخاص، النوافذ، الإضاءة، الأجهزة، والجدران." 
            />
            <FeatureCard 
              icon={<WindIcon />}
              title="تدفق الهواء CFM" 
              description="حساب معدل تدفق الهواء المطلوب بناءً على الأحمال الحرارية." 
            />
            <FeatureCard 
              icon={<RulerIcon />}
              title="مقاسات الدكتات" 
              description="تحديد القطر والمقاسات المستطيلة للدكتات بدقة." 
            />
            <FeatureCard 
              icon={<CalculatorIcon />}
              title="كميات المواد" 
              description="حساب الصاج، العازل، الفلنجات، والمسامير المطلوبة." 
            />
            <FeatureCard 
              icon={<SaveIcon />}
              title="حفظ المشاريع" 
              description="إمكانية حفظ المشاريع والرجوع إليها في أي وقت." 
            />
            <FeatureCard 
              icon={<ReportIcon />}
              title="تقارير تفصيلية" 
              description="عرض جميع النتائج في تقرير شامل قابل للطباعة." 
            />
          </div>
        </div>

        {/* How It Works Section */}
        <div className="max-w-7xl mx-auto mt-24">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">كيف يعمل البرنامج؟</h2>
            <p className="mt-2 text-lg text-gray-400">أربع خطوات بسيطة للحصول على نتائجك</p>
          </div>
          <div className="mt-12 max-w-xl mx-auto">
              <Step number="1" title="إدخال البيانات" description="أدخل معلومات الغرفة، الأشخاص، النوافذ، الإضاءة، والأجهزة." />
              <Step number="2" title="الحساب التلقائي" description="يقوم البرنامج بحساب جميع الأحمال والمعادلات تلقائياً." />
              <Step number="3" title="عرض النتائج" description="احصل على تقرير شامل بجميع الحسابات والكميات المطلوبة." />
              <div className="flex">
                  <div className="flex flex-col items-center mr-4">
                    <div>
                      <div className="flex items-center justify-center w-10 h-10 border-2 border-cyan-400 rounded-full text-cyan-400 font-bold">
                         4
                      </div>
                    </div>
                  </div>
                  <div className="pt-1">
                    <p className="mb-2 text-xl font-bold text-white">حفظ وطباعة</p>
                    <p className="text-gray-400">احفظ المشروع في قاعدة البيانات أو قم بطباعة تقريرك مباشرة.</p>
                  </div>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
