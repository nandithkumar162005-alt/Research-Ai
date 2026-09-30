import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Search, Settings, Activity, Moon, Sun } from 'lucide-react';
import { mockSystemStatus } from '../data/mockResearch';

export const Sidebar = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <div className="w-64 h-screen border-r border-border bg-card hidden md:flex flex-col z-20">
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-research-indigo shadow-glow flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-lg tracking-tight text-foreground">Research Radar</span>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 px-4 space-y-1 mt-4">
        <NavLink 
          to="/" 
          className={({ isActive }) => 
            `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all font-medium ${
              isActive 
                ? 'bg-muted text-foreground' 
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`
          }
        >
          <Search className="w-4 h-4" />
          Research
        </NavLink>
        <NavLink 
          to="/settings" 
          className={({ isActive }) => 
            `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all font-medium ${
              isActive 
                ? 'bg-muted text-foreground' 
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`
          }
        >
          <Settings className="w-4 h-4" />
          API Settings
        </NavLink>
      </nav>
      
      <div className="p-4 border-t border-border">
        <div className="flex flex-col gap-1 mb-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">System Status</span>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-2 h-2 rounded-full ${mockSystemStatus.engineReady ? 'bg-research-green' : 'bg-research-red'} shadow-sm`}></div>
            <span className="text-sm font-medium text-foreground">
              {mockSystemStatus.engineReady ? 'Research engine ready' : 'Engine offline'}
            </span>
          </div>
        </div>
        
        <button 
          onClick={toggleTheme}
          className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted rounded-lg transition-all"
        >
          <div className="flex items-center gap-2">
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          </div>
        </button>
      </div>
    </div>
  );
};
