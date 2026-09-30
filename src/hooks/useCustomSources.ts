import { useState, useEffect } from 'react';

export interface CustomSource {
  id: string;
  name: string;
  endpoint: string;
}

export const useCustomSources = () => {
  const [customSources, setCustomSources] = useState<CustomSource[]>(() => {
    const saved = localStorage.getItem('research_radar_custom_sources');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('research_radar_custom_sources', JSON.stringify(customSources));
  }, [customSources]);

  const addSource = (source: CustomSource) => {
    setCustomSources(prev => [...prev, source]);
  };

  const removeSource = (id: string) => {
    setCustomSources(prev => prev.filter(s => s.id !== id));
  };

  return { customSources, addSource, removeSource };
};
