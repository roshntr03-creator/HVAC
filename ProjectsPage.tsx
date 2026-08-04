import React, { useRef } from 'react';
import type { Project } from './types';
import { useLanguage } from './LanguageContext';
import { ThermometerIcon, WindIcon, Trash2Icon, EyeIcon, FolderIcon, DownloadIcon, ClipboardIcon } from './Icons';

interface ProjectsPageProps {
  projects: Project[];
  onNavigate: (page: 'home' | 'calculator') => void;
  onDeleteProject: (projectId: string) => void;
  onLoadProject: (projectId: string) => void;
  onImportProjects?: (importedProjects: Project[]) => void;
  onDuplicateProject?: (project: Project) => void;
}

const LanguageSwitcher = () => {
  const { language, setLanguage } = useLanguage();
  const toggleLanguage = () => setLanguage(language === 'ar' ? 'en' : 'ar');
  return (
    <button onClick={toggleLanguage} className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg border border-gray-700 transition text-sm">
      {language === 'ar' ? 'English' : 'العربية'}
    </button>
  );
};

const ProjectCard: React.FC<{ 
  project: Project; 
  onDelete: () => void; 
  onLoad: () => void;
  onDuplicate?: () => void;
}> = ({ project, onDelete, onLoad, onDuplicate }) => {
    const { t, language } = useLanguage();
    const { name, createdAt, results } = project;
    const locale = language === 'ar' ? 'ar-EG' : 'en-US';
    
    const tons = results?.legacy?.totalLoadTons;
    const cfm = results?.legacy?.airflowCFM;
    
    return (
        <div className="bg-gray-800 rounded-xl shadow-xl p-6 flex flex-col justify-between border border-gray-700 hover:border-cyan-500/50 hover:shadow-cyan-500/10 hover:-translate-y-1 transition-all duration-300">
            <div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-xl font-bold text-white truncate max-w-[200px]" title={name}>{name}</h3>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-cyan-950 text-cyan-400 border border-cyan-800 rounded-full">
                    {results?.projectInfo?.location || 'HVAC'}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mb-4">
                    {new Date(createdAt).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
                <div className="space-y-2.5 text-gray-300 text-sm">
                    <div className="flex items-center gap-2">
                        <ThermometerIcon className="h-5 w-5 text-cyan-400" />
                        <span>{t('thermalLoad')}: <strong className="text-white">{typeof tons === 'number' ? tons.toFixed(2) : 'N/A'}</strong> {t('tons')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <WindIcon className="h-5 w-5 text-cyan-400" />
                        <span>{t('airflow')}: <strong className="text-white">{typeof cfm === 'number' ? cfm.toLocaleString() : 'N/A'}</strong> {t('cfm')}</span>
                    </div>
                </div>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-gray-700/80 pt-4 gap-2">
                <div className="flex gap-1">
                  {onDuplicate && (
                    <button onClick={onDuplicate} className="text-gray-400 hover:text-cyan-400 transition-colors p-2 rounded-lg hover:bg-gray-700" title={t('duplicateProject')}>
                      <ClipboardIcon />
                    </button>
                  )}
                  <button onClick={onDelete} className="text-gray-400 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-gray-700" title="Delete">
                      <Trash2Icon />
                  </button>
                </div>
                <button onClick={onLoad} className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-2 px-4 rounded-lg transition text-sm">
                    <EyeIcon className="h-4 w-4" />
                    <span>{t('viewDetails')}</span>
                </button>
            </div>
        </div>
    );
};

const ProjectsPage: React.FC<ProjectsPageProps> = ({ projects, onNavigate, onDeleteProject, onLoadProject, onImportProjects, onDuplicateProject }) => {
    const { t } = useLanguage();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const sortedProjects = [...projects].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const handleExport = () => {
      if (projects.length === 0) return;
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projects, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `emaar_hvac_backup_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    };

    const handleImportClick = () => {
      fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed) && onImportProjects) {
            onImportProjects(parsed);
          } else {
            alert(t('importError'));
          }
        } catch (err) {
          alert(t('importError'));
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    };

    return (
        <div className="bg-gray-900 text-white min-h-screen p-4 sm:p-6 lg:p-8 flex-grow font-sans">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />

            <header className="flex flex-col sm:flex-row justify-between sm:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-cyan-400">{t('projects_title')}</h1>
                    <p className="text-sm text-gray-300 mt-1">{t('projects_subtitle')}</p>
                </div>
                 <div className="flex gap-3 flex-wrap">
                    {projects.length > 0 && (
                      <button onClick={handleExport} className="bg-gray-800 hover:bg-gray-700 text-cyan-400 font-semibold py-2 px-4 rounded-lg border border-gray-700 transition text-sm flex items-center gap-2">
                        <DownloadIcon />
                        <span>{t('exportProjects')}</span>
                      </button>
                    )}
                    <button onClick={handleImportClick} className="bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold py-2 px-4 rounded-lg border border-gray-700 transition text-sm">
                      {t('importProjects')}
                    </button>
                    <LanguageSwitcher />
                    <button onClick={() => onNavigate('home')} className="bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold py-2 px-4 rounded-lg border border-gray-700 transition text-sm">
                        {t('home')}
                    </button>
                    <button onClick={() => onNavigate('calculator')} className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 px-4 rounded-lg transition text-sm">
                        + {t('newCalculation')}
                    </button>
                </div>
            </header>
            
            <div className="bg-amber-950/40 border border-amber-600/50 text-amber-200 px-4 py-3 rounded-xl relative mb-6 text-sm" role="alert">
                <strong className="font-semibold">{t('importantNote')} </strong>
                <span>{t('note_local_save')}</span>
            </div>

            {sortedProjects.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {sortedProjects.map(project => (
                        <ProjectCard 
                            key={project.id} 
                            project={project} 
                            onDelete={() => {
                              if (confirm(t('deleteProjectConfirm'))) {
                                onDeleteProject(project.id);
                              }
                            }}
                            onLoad={() => onLoadProject(project.id)}
                            onDuplicate={() => onDuplicateProject && onDuplicateProject(project)}
                        />
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 bg-gray-800/60 border border-gray-700/60 rounded-2xl">
                    <div className="flex justify-center text-cyan-400 mb-2">
                      <FolderIcon />
                    </div>
                    <h2 className="text-2xl font-bold text-white mt-2">{t('noProjects_title')}</h2>
                    <p className="text-gray-400 mt-2 mb-6 text-sm">{t('noProjects_desc')}</p>
                    <button onClick={() => onNavigate('calculator')} className="bg-cyan-500 hover:bg-cyan-400 text-gray-950 font-bold py-3 px-8 rounded-xl text-base shadow-lg transition">
                        {t('noProjects_cta')}
                    </button>
                </div>
            )}
        </div>
    );
};

export default ProjectsPage;
