import React, { useState, useEffect } from 'react';
import HomePage from './HomePage';
import CalculatorPage from './CalculatorPage';
import ProjectsPage from './ProjectsPage';
import type { Project, InputState, ResultsState } from './types';
import { LanguageProvider, useLanguage } from './LanguageContext';

const AppContent: React.FC = () => {
  const [page, setPage] = useState<'home' | 'calculator' | 'projects'>('home');
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const { t } = useLanguage();

  // Load projects from localStorage on initial render
  useEffect(() => {
    try {
      const savedProjects = localStorage.getItem('emaar_hvac_projects');
      if (savedProjects) {
        setProjects(JSON.parse(savedProjects));
      }
    } catch (error) {
      console.error("Failed to load projects from localStorage", error);
      localStorage.removeItem('emaar_hvac_projects');
    }
  }, []);

  // Save projects to localStorage whenever the projects state changes
  useEffect(() => {
    try {
      localStorage.setItem('emaar_hvac_projects', JSON.stringify(projects));
    } catch (error) {
      console.error("Failed to save projects to localStorage", error);
    }
  }, [projects]);

  const handleNavigate = (targetPage: 'home' | 'calculator' | 'projects') => {
    if (targetPage === 'calculator') {
        setActiveProject(null);
    }
    setPage(targetPage);
  };

  const handleDeleteProject = (projectId: string) => {
    setProjects(prevProjects => prevProjects.filter(p => p.id !== projectId));
  };
  
  const handleSaveProject = (inputs: InputState, results: ResultsState) => {
    const newProject: Project = { 
        id: new Date().toISOString(), 
        name: inputs.projectName, 
        inputs,
        results,
        createdAt: new Date().toISOString()
    };
    
    setProjects(prevProjects => [newProject, ...prevProjects]);
    setPage('projects');
  };
  
  const handleLoadProject = (projectId: string) => {
    const projectToLoad = projects.find(p => p.id === projectId);
    if (projectToLoad) {
      setActiveProject(projectToLoad);
      setPage('calculator');
    }
  };

  const handleImportProjects = (imported: Project[]) => {
    setProjects(prev => {
      const existingIds = new Set(prev.map(p => p.id));
      const validNew = imported.filter(p => p.id && p.name && p.inputs && p.results && !existingIds.has(p.id));
      return [...validNew, ...prev];
    });
  };

  const handleDuplicateProject = (project: Project) => {
    const duplicated: Project = {
      ...project,
      id: new Date().toISOString() + '-' + Math.random().toString(36).substring(2, 6),
      name: project.name + ' (Copy)',
      createdAt: new Date().toISOString()
    };
    setProjects(prev => [duplicated, ...prev]);
  };
  
  const Footer = () => (
    <footer className="bg-gray-800 border-t border-gray-700 text-center p-4 text-gray-400 text-sm mt-auto print:hidden">
      <p>{t('footerCopyright')}</p>
    </footer>
  );

  const renderPage = () => {
    switch(page) {
      case 'home':
        return <HomePage onNavigate={handleNavigate} />;
      case 'calculator':
        return <CalculatorPage onNavigate={handleNavigate} onSaveProject={handleSaveProject} activeProject={activeProject} />;
      case 'projects':
        return <ProjectsPage 
                  onNavigate={handleNavigate} 
                  projects={projects} 
                  onDeleteProject={handleDeleteProject} 
                  onLoadProject={handleLoadProject} 
                  onImportProjects={handleImportProjects}
                  onDuplicateProject={handleDuplicateProject}
                />;
      default:
        return <HomePage onNavigate={handleNavigate} />;
    }
  }

  return (
    <main className="flex flex-col min-h-screen">
      {renderPage()}
      <Footer />
    </main>
  );
};

const App: React.FC = () => (
  <LanguageProvider>
    <AppContent />
  </LanguageProvider>
);

export default App;
