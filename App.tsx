import React, { useState, useEffect, useRef } from 'react';
import HomePage from './HomePage';
import CalculatorPage from './CalculatorPage';
import ProjectsPage from './ProjectsPage';
import type { Project, InputState, ResultsState } from './types';
import { LanguageProvider, useLanguage } from './LanguageContext';

const AppContent: React.FC = () => {
  const [page, setPage] = useState<'home' | 'calculator' | 'projects'>('home');
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const projectTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const { t } = useLanguage();

  useEffect(() => {
    const timeouts = projectTimeouts.current;
    return () => {
      timeouts.forEach(timeoutId => clearTimeout(timeoutId));
    };
  }, []);

  const handleNavigate = (targetPage: 'home' | 'calculator' | 'projects') => {
    if (targetPage === 'calculator') {
        setActiveProject(null);
    }
    setPage(targetPage);
  };

  const handleDeleteProject = (projectId: string) => {
    const timeoutId = projectTimeouts.current.get(projectId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      projectTimeouts.current.delete(projectId);
    }
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
    
    setProjects(prevProjects => [...prevProjects, newProject]);

    const thirtyMinutes = 30 * 60 * 1000;
    const timeoutId = setTimeout(() => {
      handleDeleteProject(newProject.id);
    }, thirtyMinutes);
    projectTimeouts.current.set(newProject.id, timeoutId);
    
    alert(t('projectSaved', { projectName: inputs.projectName }));
    setPage('projects');
  };
  
  const handleLoadProject = (projectId: string) => {
    const projectToLoad = projects.find(p => p.id === projectId);
    if (projectToLoad) {
      setActiveProject(projectToLoad);
      setPage('calculator');
    }
  };

  const manualDeleteProject = (projectId: string) => {
     if (confirm(t('deleteProjectConfirm'))) {
       handleDeleteProject(projectId);
    }
  };
  
  const Footer = () => (
    <footer className="bg-gray-800 text-center p-4 text-gray-400 mt-auto">
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
        return <ProjectsPage onNavigate={handleNavigate} projects={projects} onDeleteProject={manualDeleteProject} onLoadProject={handleLoadProject} />;
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
