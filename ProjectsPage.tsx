import React from 'react';
import type { Project } from './types';
import { ThermometerIcon, WindIcon, RulerIcon, Trash2Icon, EyeIcon, FolderIcon } from './Icons';

interface ProjectsPageProps {
  projects: Project[];
  onNavigate: (page: 'home' | 'calculator') => void;
  onDeleteProject: (projectId: string) => void;
  onLoadProject: (projectId: string) => void;
}

const ProjectCard: React.FC<{ project: Project; onDelete: () => void; onLoad: () => void; }> = ({ project, onDelete, onLoad }) => {
    const { name, createdAt, results } = project;
    
    return (
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 flex flex-col justify-between hover:shadow-cyan-500/20 hover:-translate-y-2 transition-all duration-300">
            <div>
                <h3 className="text-xl font-bold text-white mb-2 truncate">{name}</h3>
                <p className="text-sm text-gray-400 mb-4">
                    {new Date(createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
                <div className="space-y-3 text-gray-300">
                    <div className="flex items-center">
                        <ThermometerIcon className="h-5 w-5 text-cyan-400 mr-2" />
                        <span>الحمل الحراري: <strong>{results.loads.totalLoadTons.toFixed(2)}</strong> طن</span>
                    </div>
                    <div className="flex items-center">
                        <WindIcon className="h-5 w-5 text-cyan-400 mr-2" />
                        <span>تدفق الهواء: <strong>{results.airflow.cfm.toFixed(0)}</strong> CFM</span>
                    </div>
                    <div className="flex items-center">
                        <RulerIcon className="h-5 w-5 text-cyan-400 mr-2" />
                        <span>قطر الدكت: <strong>{results.ductSizing.roundDiameterIn.toFixed(1)}</strong> بوصة</span>
                    </div>
                </div>
            </div>
            <div className="mt-6 flex justify-end gap-3 border-t border-gray-700 pt-4">
                <button onClick={onDelete} className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full" aria-label="حذف المشروع">
                    <Trash2Icon />
                </button>
                <button onClick={onLoad} className="flex items-center justify-center bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                    <EyeIcon className="mr-2 h-5 w-5" />
                    عرض التفاصيل
                </button>
            </div>
        </div>
    );
};

const ProjectsPage: React.FC<ProjectsPageProps> = ({ projects, onNavigate, onDeleteProject, onLoadProject }) => {
    const sortedProjects = [...projects].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return (
        <div className="bg-gray-900 text-white min-h-screen p-4 sm:p-6 lg:p-8 flex-grow" style={{ fontFamily: 'Cairo, sans-serif' }}>
            <header className="flex flex-col sm:flex-row justify-between sm:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-4xl sm:text-5xl font-bold text-cyan-400">المشاريع المحفوظة</h1>
                    <p className="text-lg text-gray-300 mt-2">عرض وإدارة جميع حساباتك السابقة</p>
                </div>
                 <div className="flex gap-4">
                    <button onClick={() => onNavigate('home')} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded transition-colors">
                        → الرئيسية
                    </button>
                    <button onClick={() => onNavigate('calculator')} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition-colors">
                        + حساب جديد
                    </button>
                </div>
            </header>
            
            <div className="bg-yellow-900/50 border border-yellow-700 text-yellow-300 px-4 py-3 rounded-lg relative mb-6" role="alert">
                <strong className="font-bold">ملاحظة هامة: </strong>
                <span className="block sm:inline">المشاريع يتم حفظها مؤقتاً لمدة 30 دقيقة فقط في هذه الجلسة. سيتم حذفها بعد ذلك أو عند تحديث الصفحة.</span>
            </div>

            {sortedProjects.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {sortedProjects.map(project => (
                        <ProjectCard 
                            key={project.id} 
                            project={project} 
                            onDelete={() => onDeleteProject(project.id)}
                            onLoad={() => onLoadProject(project.id)}
                        />
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 bg-gray-800 rounded-lg">
                    <FolderIcon />
                    <h2 className="text-2xl font-bold text-white mt-4">لا توجد مشاريع محفوظة</h2>
                    <p className="text-gray-400 mt-2 mb-6">ابدأ حسابًا جديدًا لحفظه هنا.</p>
                    <button onClick={() => onNavigate('calculator')} className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 px-8 rounded-lg text-lg">
                        ابدأ الحساب الآن
                    </button>
                </div>
            )}
        </div>
    );
};

export default ProjectsPage;