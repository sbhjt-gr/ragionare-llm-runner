import { initLlama, loadLlamaModelInfo, type LlamaContext } from 'llama.rn';
import { Platform, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ModelMemoryInfo {
  requiredMemory: number;
  availableMemory: number;
}

interface LlamaManagerInterface {
  getMemoryInfo(): Promise<ModelMemoryInfo>;
}

interface ModelSettings {
  maxTokens: number;
  temperature: number;
  topK: number;
  topP: number;
  minP: number;
  stopWords: string[];
}

const DEFAULT_SETTINGS: ModelSettings = {
  maxTokens: 1200,
  temperature: 0.7,
  topK: 40,
  topP: 0.9,
  minP: 0.05,
  stopWords: ['</s>', '<|end|>', '<|im_end|>', '<|endoftext|>', '<｜end_of_sentence｜>'],
};

// Type assertion for the native module
const LlamaManagerModule = NativeModules.LlamaManager as LlamaManagerInterface;

class LlamaManager {
  private context: LlamaContext | null = null;
  private modelPath: string | null = null;
  private settings: ModelSettings = { ...DEFAULT_SETTINGS };

  async initializeModel(modelPath: string) {
    try {
      // First load model info to validate the model
      const modelInfo = await loadLlamaModelInfo(modelPath);
      console.log('Model Info:', modelInfo);

      // Release existing context if any
      if (this.context) {
        await this.context.release();
        this.context = null;
      }

      this.modelPath = modelPath;
      
      // Load settings
      await this.loadSettings();
      
      // Initialize with recommended settings
      this.context = await initLlama({
        model: modelPath,
        use_mlock: true,
        n_ctx: 6144,
        n_batch: 512,
        n_threads: Platform.OS === 'ios' ? 6 : 4,
        n_gpu_layers: Platform.OS === 'ios' ? 1 : 0,
        embedding: false,
        rope_freq_base: 10000,
        rope_freq_scale: 1,
      });

      return this.context;
    } catch (error) {
      console.error('Model initialization error:', error);
      throw new Error(`Failed to initialize model: ${error}`);
    }
  }

  async loadSettings() {
    try {
      const savedSettings = await AsyncStorage.getItem('@model_settings');
      if (savedSettings) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  async saveSettings() {
    try {
      await AsyncStorage.setItem('@model_settings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  async resetSettings() {
    this.settings = { ...DEFAULT_SETTINGS };
    await this.saveSettings();
  }

  // Settings getters and setters
  getSettings(): ModelSettings {
    return { ...this.settings };
  }

  async updateSettings(newSettings: Partial<ModelSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    await this.saveSettings();
  }

  // Individual setting getters for backward compatibility
  getMaxTokens(): number {
    return this.settings.maxTokens;
  }

  async setMaxTokens(tokens: number) {
    await this.updateSettings({ maxTokens: tokens });
  }

  async generateResponse(
    messages: Array<{ role: string; content: string }>,
    onToken?: (token: string) => void
  ) {
    if (!this.context) {
      throw new Error('Model not initialized');
    }

    let fullResponse = '';

    try {
      const result = await this.context.completion(
        {
          messages,
          n_predict: this.settings.maxTokens,
          stop: this.settings.stopWords,
          temperature: this.settings.temperature,
          top_k: this.settings.topK,
          top_p: this.settings.topP,
          min_p: this.settings.minP,
          mirostat: 2,
          mirostat_tau: 5.0,
          mirostat_eta: 0.1,
        },
        (data) => {
          // Only check for complete stop words, not partial matches
          if (!this.settings.stopWords.includes(data.token)) {
            fullResponse += data.token;
            onToken?.(data.token);
            return true;
          }
          return false;
        }
      );

      return fullResponse.trim();
    } catch (error) {
      console.error('Generation error:', error);
      throw error;
    }
  }

  async release() {
    try {
      if (this.context) {
        await this.context.release();
        this.context = null;
        this.modelPath = null;
      }
    } catch (error) {
      console.error('Release error:', error);
      throw error;
    }
  }

  getModelPath() {
    return this.modelPath;
  }

  async checkMemoryRequirements(): Promise<ModelMemoryInfo> {
    try {
      if (!LlamaManagerModule?.getMemoryInfo) {
        return {
          requiredMemory: 0,
          availableMemory: 0
        };
      }
      return await LlamaManagerModule.getMemoryInfo();
    } catch (error) {
      console.warn('Memory info check failed:', error);
      return {
        requiredMemory: 0,
        availableMemory: 0
      };
    }
  }

  isInitialized(): boolean {
    return this.context !== null;
  }
}

export const llamaManager = new LlamaManager(); 