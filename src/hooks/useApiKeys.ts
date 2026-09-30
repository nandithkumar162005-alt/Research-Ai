import { useState, useEffect } from 'react';

export interface ApiKeys {
  gemini: string;
  groq: string;
  exa: string;
  tavily: string;
  [key: string]: string;
}

const defaultKeys: ApiKeys = {
  gemini: import.meta.env.VITE_GEMINI_API_KEY || '',
  groq: import.meta.env.VITE_GROQ_API_KEY || '',
  exa: import.meta.env.VITE_EXA_API_KEY || '',
  tavily: import.meta.env.VITE_TAVILY_API_KEY || '',
};

export const useApiKeys = () => {
  const [keys, setKeys] = useState<ApiKeys>(() => {
    const saved = localStorage.getItem('research_radar_keys');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...defaultKeys, ...parsed };
      } catch (e) {
        return defaultKeys;
      }
    }
    return defaultKeys;
  });

  useEffect(() => {
    localStorage.setItem('research_radar_keys', JSON.stringify(keys));
  }, [keys]);

  const updateKey = (provider: keyof ApiKeys, value: string) => {
    setKeys(prev => ({ ...prev, [provider]: value }));
  };

  return { keys, updateKey };
};
