
import React, { useState, useEffect, useRef } from 'react';
import HomePage from './HomePage';
import CalculatorPage from './CalculatorPage';
import ProjectsPage from './ProjectsPage';
import type { Project, InputState, ResultsState } from './types';

const App: React.FC = () => {
  const [page, setPage] = useState<'home' | 'calculator' | 'projects'>('home');
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  // Fix: Cannot find namespace 'NodeJS'. In a browser environment, setTimeout returns a number, not a NodeJS.Timeout object. Using ReturnType<typeof setTimeout> is a safe, environment-agnostic way to get the correct type.
  const projectTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Cleanup timeouts on component unmount
  useEffect(() => {
    const timeouts = projectTimeouts.current;
    return () => {
      timeouts.forEach(timeoutId => clearTimeout(timeoutId));
    };
  }, []);

  const handleNavigate = (targetPage: 'home' | 'calculator' | 'projects') => {
    if (targetPage === 'calculator') {
        setActiveProject(null); // Start a new calculation
    }
    setPage(targetPage);
  };

  const handleDeleteProject = (projectId: string) => {
    // Clear any scheduled deletion timeout
    const timeoutId = projectTimeouts.current.get(projectId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      projectTimeouts.current.delete(projectId);
    }
    // Remove project from state
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
    
    // Add project to state
    setProjects(prevProjects => [...prevProjects, newProject]);

    // Schedule project deletion after 30 minutes
    const thirtyMinutes = 30 * 60 * 1000;
    const timeoutId = setTimeout(() => {
      handleDeleteProject(newProject.id);
    }, thirtyMinutes);
    projectTimeouts.current.set(newProject.id, timeoutId);
    
    alert(`تم حفظ المشروع "${inputs.projectName}" مؤقتاً لمدة 30 دقيقة.`);
    setPage('projects'); // Navigate to projects page after saving
  };
  
  const handleLoadProject = (projectId: string) => {
    const projectToLoad = projects.find(p => p.id === projectId);
    if (projectToLoad) {
      setActiveProject(projectToLoad);
      setPage('calculator');
    }
  };

  const manualDeleteProject = (projectId: string) => {
     if (confirm('هل أنت متأكد من رغبتك في حذف هذا المشروع؟')) {
       handleDeleteProject(projectId);
    }
  };
  
  const Footer = () => (
    <footer className="bg-gray-800 text-center p-4 text-gray-400 mt-auto">
      <p>© 2025 Emaar HVAC. جميع الحقوق محفوظة.</p>
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

export default App;
