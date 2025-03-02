import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface DownloadProgress {
  [key: string]: {
    downloadId: number;
    progress: number;
    bytesDownloaded: number;
    totalBytes: number;
    status: string;
  };
}

interface DownloadContextType {
  downloadProgress: DownloadProgress;
  setDownloadProgress: React.Dispatch<React.SetStateAction<DownloadProgress>>;
  activeDownloadsCount: number;
}

const DownloadContext = createContext<DownloadContextType | undefined>(undefined);

export const DownloadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>({});
  const activeDownloadsCount = Object.values(downloadProgress).filter(
    d => d.status !== 'completed' && d.status !== 'failed' && d.progress < 100
  ).length;

  // Load saved download states on mount
  useEffect(() => {
    const loadSavedStates = async () => {
      try {
        const savedProgress = await AsyncStorage.getItem('download_progress');
        if (savedProgress) {
          const parsedProgress = JSON.parse(savedProgress);
          
          // Filter out any completed, failed, or 100% progress downloads
          const filteredProgress = Object.entries(parsedProgress).reduce((acc, [key, value]) => {
            if (value.status !== 'completed' && 
                value.status !== 'failed' && 
                value.progress < 100) {
              acc[key] = value;
            }
            return acc;
          }, {} as DownloadProgress);
          
          setDownloadProgress(filteredProgress);
        }
      } catch (error) {
        console.error('Error loading download states:', error);
      }
    };
    loadSavedStates();
  }, []);

  // Save download states whenever they change
  useEffect(() => {
    const saveStates = async () => {
      try {
        if (Object.keys(downloadProgress).length > 0) {
          await AsyncStorage.setItem('download_progress', JSON.stringify(downloadProgress));
        } else {
          await AsyncStorage.removeItem('download_progress');
        }
      } catch (error) {
        console.error('Error saving download states:', error);
      }
    };
    saveStates();
  }, [downloadProgress]);

  return (
    <DownloadContext.Provider value={{ downloadProgress, setDownloadProgress, activeDownloadsCount }}>
      {children}
    </DownloadContext.Provider>
  );
};

export const useDownloads = () => {
  const context = useContext(DownloadContext);
  if (context === undefined) {
    throw new Error('useDownloads must be used within a DownloadProvider');
  }
  return context;
}; 