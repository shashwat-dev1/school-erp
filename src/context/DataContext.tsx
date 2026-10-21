/**
 * HanuJai High School ERP — Data Context Provider
 */

import React, { createContext, useContext, useMemo } from 'react';
import type { DataProvider } from '../data/provider';
import { getDataProvider, demoRepository } from '../data';
import { getDataMode, type DataMode } from '../config/firebase';

interface DataContextType {
  provider: DataProvider;
  dataMode: DataMode;
  isDemo: boolean;
  resetDemoData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dataMode = getDataMode();
  const provider = useMemo(() => getDataProvider(), []);
  const isDemo = dataMode === 'demo';

  const resetDemoData = async () => {
    if (dataMode === 'demo' && demoRepository.resetDemoData) {
      await demoRepository.resetDemoData();
      window.location.reload();
    }
  };

  return (
    <DataContext.Provider value={{ provider, dataMode, isDemo, resetDemoData }}>
      {children}
    </DataContext.Provider>
  );
};

export function useData(): DataContextType {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataContextProvider');
  }
  return context;
}
