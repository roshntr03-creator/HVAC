import React from 'react';
import { ThermometerIcon, WindIcon, RulerIcon, CalculatorIcon, SaveIcon, ReportIcon, ArrowRightIcon } from './Icons';
import { useLanguage } from './LanguageContext';

interface HomePageProps {
  onNavigate: (page: 'calculator' | 'projects') => void;
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
    <div className="flex flex-col items-center ltr:mr-4 rtl:ml-4">
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
  const { t } = useLanguage();
  return (
    <div className="bg-gray-900 text-white" style={{ fontFamily: 'Cairo, sans-serif' }}>
       <div className="absolute top-4 ltr:right-4 rtl:left-4 z-20">
          <LanguageSwitcher />
      </div>
      {/* Hero Section */}
      <div className="relative text-center bg-gray-800 py-20 sm:py-32 overflow-hidden">
         <div className="absolute inset-0 bg-cover bg-center opacity-10" style={{backgroundImage: "url('https://images.unsplash.com/photo-1558017487-957252061266?q=80&w=2070&auto=format&fit=crop')"}}></div>
         <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent"></div>
         <div className="relative z-10 max-w-4xl mx-auto px-4">
            <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight">
                <span className="text-cyan-400">Emaar</span> HVAC
            </h1>
            <p className="mt-4 text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto">
                {t('home_subtitle')}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
                <button 
                    onClick={() => onNavigate('calculator')}
                    className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 px-8 rounded-lg text-lg shadow-lg hover:shadow-cyan-500/40 transform hover:-translate-y-1 transition-all duration-300 flex items-center justify-center"
                >
                    {t('startNewCalculation')}
                    <div className="rtl:rotate-180"><ArrowRightIcon /></div>
                </button>
                 <button 
                    onClick={() => onNavigate('projects')}
                    className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-8 rounded-lg text-lg shadow-lg hover:shadow-gray-600/40 transform hover:-translate-y-1 transition-all duration-300"
                >
                    {t('savedProjects')}
                </button>
            </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
        {/* Features Section */}
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">{t('mainFeatures')}</h2>
            <p className="mt-2 text-lg text-gray-400">{t('featuresSubtitle')}</p>
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard 
              icon={<ThermometerIcon />}
              title={t('feature1_title')} 
              description={t('feature1_desc')} 
            />
            <FeatureCard 
              icon={<WindIcon />}
              title={t('feature2_title')}
              description={t('feature2_desc')}
            />
            <FeatureCard 
              icon={<RulerIcon />}
              title={t('feature3_title')}
              description={t('feature3_desc')}
            />
            <FeatureCard 
              icon={<CalculatorIcon />}
              title={t('feature4_title')}
              description={t('feature4_desc')}
            />
            <FeatureCard 
              icon={<SaveIcon />}
              title={t('feature5_title')}
              description={t('feature5_desc')}
            />
            <FeatureCard 
              icon={<ReportIcon />}
              title={t('feature6_title')}
              description={t('feature6_desc')}
            />
          </div>
        </div>

        {/* How It Works Section */}
        <div className="max-w-7xl mx-auto mt-24">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">{t('howItWorks')}</h2>
            <p className="mt-2 text-lg text-gray-400">{t('howItWorksSubtitle')}</p>
          </div>
          <div className="mt-12 max-w-xl mx-auto">
              <Step number="1" title={t('step1_title')} description={t('step1_desc')} />
              <Step number="2" title={t('step2_title')} description={t('step2_desc')} />
              <Step number="3" title={t('step3_title')} description={t('step3_desc')} />
              <div className="flex">
                  <div className="flex flex-col items-center ltr:mr-4 rtl:ml-4">
                    <div>
                      <div className="flex items-center justify-center w-10 h-10 border-2 border-cyan-400 rounded-full text-cyan-400 font-bold">
                         4
                      </div>
                    </div>
                  </div>
                  <div className="pt-1">
                    <p className="mb-2 text-xl font-bold text-white">{t('step4_title')}</p>
                    <p className="text-gray-400">{t('step4_desc')}</p>
                  </div>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;