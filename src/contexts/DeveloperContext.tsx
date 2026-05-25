import React, { createContext, useContext, useState, useEffect } from 'react';

export type SceneMode = 'bathroom' | 'living-room';

interface DeveloperContextType {
  isDeveloperMode: boolean;
  setIsDeveloperMode: (value: boolean) => void;
  manualState: 'safe' | 'fall' | null;
  setManualState: (state: 'safe' | 'fall' | null) => void;
  sceneMode: SceneMode;
  setSceneMode: (mode: SceneMode) => void;
  sensitivity: number; // 0 to 1
}

const DeveloperContext = createContext<DeveloperContextType | undefined>(undefined);

export function DeveloperProvider({ children }: { children: React.ReactNode }) {
  const [isDeveloperMode, setIsDeveloperMode] = useState(() => {
    const saved = localStorage.getItem('developerMode');
    return saved === 'true';
  });

  const [sceneMode, setSceneMode] = useState<SceneMode>(() => {
    const saved = localStorage.getItem('sceneMode');
    return (saved as SceneMode) || 'living-room';
  });

  const [manualState, setManualState] = useState<'safe' | 'fall' | null>(null);

  const sensitivity = sceneMode === 'bathroom' ? 0.9 : 0.4;

  useEffect(() => {
    localStorage.setItem('developerMode', String(isDeveloperMode));
  }, [isDeveloperMode]);

  useEffect(() => {
    localStorage.setItem('sceneMode', sceneMode);
  }, [sceneMode]);

  return (
    <DeveloperContext.Provider value={{ 
      isDeveloperMode, 
      setIsDeveloperMode, 
      manualState, 
      setManualState,
      sceneMode,
      setSceneMode,
      sensitivity
    }}>
      {children}
    </DeveloperContext.Provider>
  );
}

export function useDeveloper() {
  const context = useContext(DeveloperContext);
  if (context === undefined) {
    throw new Error('useDeveloper must be used within a DeveloperProvider');
  }
  return context;
}
