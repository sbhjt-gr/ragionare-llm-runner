import { AppState, AppStateStatus, Platform } from 'react-native';
import * as Device from 'expo-device';
import { EventEmitter } from './EventEmitter';
import { FileManager } from './FileManager';
import { StoredModelsManager } from './StoredModelsManager';
import { DownloadTaskManager } from './DownloadTaskManager';
import { downloadNotificationService } from './DownloadNotificationService';
import { StoredModel } from './ModelDownloaderTypes';

class ModelDownloader extends EventEmitter {
  private fileManager: FileManager;
  private storedModelsManager: StoredModelsManager;
  private downloadTaskManager: DownloadTaskManager;
  private appState: AppStateStatus = AppState.currentState;
  private isInitialized: boolean = false;
  private hasNotificationPermission: boolean = false;

  constructor() {
    super();
    this.fileManager = new FileManager();
    this.storedModelsManager = new StoredModelsManager(this.fileManager);
    this.downloadTaskManager = new DownloadTaskManager(this.fileManager);
    
    this.setupEventForwarding();
    
    this.initialize();
  }

  private setupEventForwarding(): void {
    this.fileManager.on('importProgress', (data) => {
      this.emit('importProgress', data);
    });

    this.storedModelsManager.on('modelsChanged', () => {
      this.emit('modelsChanged');
    });
    this.storedModelsManager.on('downloadProgress', (data) => {
      this.emit('downloadProgress', data);
    });

    this.downloadTaskManager.on('downloadProgress', (data) => {
      this.emit('downloadProgress', data);
    });
  }

  private async initialize() {
    try {
      await this.fileManager.initializeDirectories();
      
      await this.storedModelsManager.initialize();

      await this.downloadTaskManager.initialize();
      
      AppState.addEventListener('change', this.handleAppStateChange);
      
      await this.setupNotifications();
      
      await this.downloadTaskManager.processCompletedDownloads();
      
      await this.fileManager.cleanupTempDirectory();
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Error initializing model downloader:', error);
    }
  }

  private async setupNotifications() {
    if (Platform.OS === 'android') {
      await downloadNotificationService.requestPermissions();
    }
  }

  private async requestNotificationPermissions(): Promise<boolean> {
    if (Device.isDevice) {
      if (Platform.OS === 'android') {
        const granted = await downloadNotificationService.requestPermissions();
        this.hasNotificationPermission = granted;
        return granted;
      }
    }
    return false;
  }

  private handleAppStateChange = async (nextAppState: AppStateStatus) => {
    console.log('[ModelDownloader] App state changed to:', nextAppState);
    
    if (nextAppState === 'inactive') {
      console.log('[ModelDownloader] App is being closed');
    }
  };

  async ensureDownloadsAreRunning(): Promise<void> {
    await this.downloadTaskManager.ensureDownloadsAreRunning();
  }

  async downloadModel(url: string, modelName: string): Promise<{ downloadId: number }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      if (!this.hasNotificationPermission) {
        if (Platform.OS === 'android') {
          this.hasNotificationPermission = await downloadNotificationService.requestPermissions();
        } else {
          this.hasNotificationPermission = await this.requestNotificationPermissions();
        }
      }
      
      return await this.downloadTaskManager.downloadModel(url, modelName);
    } catch (error) {
      console.error(`[ModelDownloader] Error starting download for ${modelName}:`, error);
      throw error;
    }
  }

  async pauseDownload(downloadId: number): Promise<void> {
    await this.downloadTaskManager.pauseDownload(downloadId);
  }

  async resumeDownload(downloadId: number): Promise<void> {
    await this.downloadTaskManager.resumeDownload(downloadId);
  }

  async cancelDownload(downloadId: number): Promise<void> {
    await this.downloadTaskManager.cancelDownload(downloadId);
  }

  async getStoredModels(): Promise<StoredModel[]> {
    return await this.storedModelsManager.getStoredModels();
  }

  async deleteModel(path: string): Promise<void> {
    await this.storedModelsManager.deleteModel(path);
  }

  async checkBackgroundDownloads(): Promise<void> {
    try {
      await this.downloadTaskManager.ensureDownloadsAreRunning();
      
      await this.downloadTaskManager.processCompletedDownloads();
      
      await this.fileManager.cleanupTempDirectory();
      
      await this.storedModelsManager.refreshStoredModels();
    } catch (error) {
      console.error('Error checking background downloads:', error);
    }
  }

  async refreshStoredModels(): Promise<void> {
    await this.storedModelsManager.refreshStoredModels();
  }

  async linkExternalModel(uri: string, fileName: string): Promise<void> {
    await this.storedModelsManager.linkExternalModel(uri, fileName);
  }

  async processCompletedDownloads(): Promise<void> {
    try {
      await this.downloadTaskManager.processCompletedDownloads();
    } catch (error) {
      console.error('[ModelDownloader] Error processing completed downloads:', error);
    }
  }
}

export const modelDownloader = new ModelDownloader(); 