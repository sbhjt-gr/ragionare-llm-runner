import { GeminiService } from './GeminiService';
import { onlineModelService } from './OnlineModelService';

let isInitialized = false;
let geminiService: GeminiService;

export const initGeminiService = (): GeminiService => {
  if (isInitialized) {
    return geminiService;
  }

  const instance = new GeminiService(
    (provider: string) => onlineModelService.getApiKey(provider)
  );
  
  onlineModelService.setGeminiServiceGetter(() => instance);
  
  isInitialized = true;
  
  geminiService = instance;
  
  return instance;
};

export { geminiService };
initGeminiService(); 