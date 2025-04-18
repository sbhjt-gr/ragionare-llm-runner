import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  Linking,
  Modal,
  ActivityIndicator,
  ScrollView,
  Animated,
  Platform,
  TextInput,
} from 'react-native';
import { CompositeNavigationProp, useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, TabParamList } from '../types/navigation';
import { useTheme } from '../context/ThemeContext';
import { theme } from '../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AppHeader from '../components/AppHeader';
import CustomUrlDialog from '../components/CustomUrlDialog';
import { modelDownloader, StoredModel, DownloadProgress } from '../services/ModelDownloader';
import { useDownloads } from '../context/DownloadContext';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as DocumentPicker from 'expo-document-picker';
import { downloadNotificationService } from '../services/DownloadNotificationService';
import { getThemeAwareColor, getDocumentIconColor, getBrowserDownloadTextColor } from '../utils/ColorUtils';
import { onlineModelService } from '../services/OnlineModelService';

type ModelScreenProps = {
  navigation: CompositeNavigationProp<
    BottomTabNavigationProp<TabParamList, 'Model'>,
    NativeStackNavigationProp<RootStackParamList>
  >;
};

interface DownloadableModel {
  name: string;
  description?: string;
  size: string;
  huggingFaceLink: string;
  modelFamily: string;
  quantization: string;
  tags?: string[];
}

const DOWNLOADABLE_MODELS: DownloadableModel[] = [
  {
    "name": "Gemma 3 Instruct - 1B",
    "description": "Google's latest compact instruction-tuned model with strong reasoning and fast inference with 1 billion parameters.",
    "size": "1.07 GB",
    "huggingFaceLink": "https://huggingface.co/unsloth/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q8_0.gguf",
    "modelFamily": "1 Billion",
    "quantization": "Q8_0",
    "tags": ["recommended", "fastest"]
  },
  {
    "name": "Gemma 3 Instruct - 4B",
    "description": "Google's latest compact instruction-tuned model with strong reasoning and fast inference with 4 billion parameters.",
    "size": "2.83 GB",
    "huggingFaceLink": "https://huggingface.co/unsloth/gemma-3-4b-it-GGUF/resolve/main/gemma-3-4b-it-Q5_K_M.gguf",
    "modelFamily": "4 Billion",
    "quantization": "Q5_K_M",
    "tags": ["recommended"]
  },
  {
    "name": "DeepSeek-R1 Distill Qwen",
    "description": "Highly optimized distillation of DeepSeek's R1 model using Qwen architecture for improved efficiency.",
    "size": "1.89 GB",
    "huggingFaceLink": "https://huggingface.co/unsloth/DeepSeek-R1-Distill-Qwen-1.5B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-1.5B-Q8_0.gguf",
    "modelFamily": "1.5 Billion",
    "quantization": "Q8_0",
    "tags": ["fastest"]
  },
  {
    "name": "Phi-3 Mini Instruct",
    "description": "Microsoft's compact instruction-tuned model with strong reasoning capabilities despite its small size.",
    "size": "2.2 GB",
    "huggingFaceLink": "https://huggingface.co/bartowski/Phi-3-mini-4k-instruct-GGUF/resolve/main/Phi-3-mini-4k-instruct-Q4_K_M.gguf",
    "modelFamily": "3.8 Billion",
    "quantization": "Q4_K_M",
    "tags": ["fastest"]
  },
  {
    "name": "Qwen 2.5 Coder Instruct",
    "description": "Alibaba's specialized coding model with excellent code completion and explanation abilities.",
    "size": "2.27 GB",
    "huggingFaceLink": "https://huggingface.co/Qwen/Qwen2.5-Coder-3B-Instruct-GGUF/resolve/main/qwen2.5-coder-3b-instruct-q5_k_m.gguf",
    "modelFamily": "7 Billion",
    "quantization": "Q5_K_M",
    "tags": ["fastest"]
  },
  {
    "name": "CodeLlama",
    "description": "Meta's code-specialized model trained on code repositories with strong programming capabilities.",
    "size": "2.95 GB",
    "huggingFaceLink": "https://huggingface.co/TheBloke/CodeLlama-7B-GGUF/resolve/main/codellama-7b.Q3_K_S.gguf",
    "modelFamily": "7 Billion",
    "quantization": "Q3_K_S"
  },
  {
    "name": "DeepSeek-R1 Distill Llama",
    "description": "Distilled version of DeepSeek's R1 model with balanced performance and efficiency.",
    "size": "3.8 GB",
    "huggingFaceLink": "https://huggingface.co/unsloth/DeepSeek-R1-Distill-Llama-8B-GGUF/resolve/main/DeepSeek-R1-Distill-Llama-8B-Q4_K_M.gguf",
    "modelFamily": "7 Billion",
    "quantization": "Q4_K_M"
  },
  {
    "name": "Mistral Instruct",
    "description": "Instruction-tuned version of Mistral's powerful base model with excellent reasoning abilities.",
    "size": "4.1 GB",
    "huggingFaceLink": "https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/mistral-7b-instruct-v0.2.Q4_K_M.gguf",
    "modelFamily": "7 Billion",
    "quantization": "Q4_K_M"
  },
  {
    "name": "DeepSeek Base",
    "description": "Foundation model from DeepSeek trained on diverse data with strong general capabilities.",
    "size": "4.6 GB",
    "huggingFaceLink": "https://huggingface.co/TheBloke/deepseek-llm-7B-base-GGUF/resolve/main/deepseek-llm-7b-base.Q4_K_S.gguf",
    "modelFamily": "8 Billion",
    "quantization": "Q4_K_S"
  },
  {
    "name": "LLaMA 3.1 Instruct",
    "description": "Meta's latest instruction-tuned model with improved reasoning and instruction following.",
    "size": "4.7 GB",
    "huggingFaceLink": "https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf",
    "modelFamily": "8 Billion",
    "quantization": "Q4_K_M"
  },
  {
    "name": "DeepSeek Coder Instruct",
    "description": "Specialized coding assistant trained on high-quality programming data with instruction tuning.",
    "size": "4.8 GB",
    "huggingFaceLink": "https://huggingface.co/TheBloke/deepseek-coder-6.7B-instruct-GGUF/resolve/main/deepseek-coder-6.7b-instruct-Q6_K.gguf",
    "modelFamily": "6.7 Billion",
    "quantization": "Q6_K"
  },
  {
    "name": "CodeGemma Instruct",
    "description": "Google's code-focused model with strong programming and technical documentation capabilities.",
    "size": "5.1 GB",
    "huggingFaceLink": "https://huggingface.co/bartowski/codegemma-7b-it-GGUF/resolve/main/codegemma-7b-it-Q6_K.gguf",
    "modelFamily": "7 Billion",
    "quantization": "Q6_K"
  },
  {
    "name": "Mistral Grok",
    "description": "Mistral's adaptation of the Grok model with enhanced conversational abilities.",
    "size": "5.1 GB",
    "huggingFaceLink": "https://huggingface.co/mradermacher/mistral-7b-grok-GGUF/resolve/main/mistral-7b-grok.Q3_K_L.gguf",
    "modelFamily": "7 Billion",
    "quantization": "Q3_K_L"
  },
  {
    "name": "Qwen 2.5 Instruct",
    "description": "Alibaba's general-purpose instruction-tuned model with strong multilingual capabilities.",
    "size": "5.2 GB",
    "huggingFaceLink": "https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF/resolve/main/Qwen2.5-7B-Instruct-Q6_K.gguf",
    "modelFamily": "7 Billion",
    "quantization": "Q6_K"
  },
  {
    "name": "Gemma 2 Instruct",
    "description": "Google's latest instruction-tuned model with excellent reasoning and helpfulness.",
    "size": "5.4 GB",
    "huggingFaceLink": "https://huggingface.co/bartowski/gemma-2-9b-it-GGUF/resolve/main/gemma-2-9b-it-Q4_K_M.gguf",
    "modelFamily": "9 Billion",
    "quantization": "Q4_K_M"
  },
  {
    "name": "LLaMA 2 Chat",
    "description": "Meta's larger chat-optimized model with enhanced reasoning and instruction following.",
    "size": "8.7 GB",
    "huggingFaceLink": "https://huggingface.co/TheBloke/Llama-2-13B-chat-GGUF/resolve/main/llama-2-13b-chat.Q5_K_M.gguf",
    "modelFamily": "13 Billion",
    "quantization": "Q5_K_M"
  }
];

const formatBytes = (bytes?: number) => {
  if (bytes === undefined || bytes === null || isNaN(bytes) || bytes === 0) return '0 B';
  try {
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    if (i < 0 || i >= sizes.length || !isFinite(bytes)) return '0 B';
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  } catch (error) {
    console.error('Error formatting bytes:', error, bytes);
    return '0 B';
  }
};

const getProgressText = (data: DownloadProgress[string]) => {
  if (!data) return '0% • 0 B / 0 B';
  
  const progress = typeof data.progress === 'number' ? data.progress : 0;
  const bytesDownloaded = typeof data.bytesDownloaded === 'number' ? data.bytesDownloaded : 0;
  const totalBytes = typeof data.totalBytes === 'number' && data.totalBytes > 0 ? data.totalBytes : 0;
  
  const downloadedFormatted = formatBytes(bytesDownloaded);
  const totalFormatted = formatBytes(totalBytes);
  
  return `${progress}% • ${downloadedFormatted} / ${totalFormatted}`;
};

const getActiveDownloadsCount = (downloads: DownloadProgress): number => {
  return Object.values(downloads).filter(
    download => download.status !== 'completed' && download.status !== 'failed'
  ).length;
};

const BACKGROUND_DOWNLOAD_TASK = 'background-download-task';

TaskManager.defineTask(BACKGROUND_DOWNLOAD_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background task error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
  
  return BackgroundFetch.BackgroundFetchResult.NewData;
});

const registerBackgroundTask = async () => {
  try {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_DOWNLOAD_TASK, {
      minimumInterval: 1,
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch (err) {
    console.error('Task registration failed:', err);
  }
};

export default function ModelScreen({ navigation }: ModelScreenProps) {
  const { theme: currentTheme } = useTheme();
  const themeColors = theme[currentTheme as 'light' | 'dark'];
  const [activeTab, setActiveTab] = useState<'stored' | 'downloadable'>('stored');
  const [storedModels, setStoredModels] = useState<StoredModel[]>([]);
  const { downloadProgress, setDownloadProgress } = useDownloads();
  const [customUrlDialogVisible, setCustomUrlDialogVisible] = useState(false);
  const [isDownloadsVisible, setIsDownloadsVisible] = useState(false);
  const buttonScale = useRef(new Animated.Value(1)).current;
  const [isLoading, setIsLoading] = useState(false);
  const [importingModelName, setImportingModelName] = useState<string | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [openAIApiKey, setOpenAIApiKey] = useState('');
  const [deepSeekApiKey, setDeepSeekApiKey] = useState('');
  const [claudeApiKey, setClaudeApiKey] = useState('');
  const [isLoadingApiKeys, setIsLoadingApiKeys] = useState(false);
  const [showGeminiApiKey, setShowGeminiApiKey] = useState(false);

  const handleLinkModel = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: false,
      });

      if (result.canceled) {
        console.log('[ModelScreen] Document picking canceled');
        return;
      }

      const file = result.assets[0];
      const fileName = file.name.toLowerCase();
      
      console.log('[ModelScreen] Selected file:', {
        name: file.name,
        uri: file.uri,
        type: file.mimeType,
        size: file.size
      });

      if (!fileName.endsWith('.gguf')) {
        Alert.alert(
          'Invalid File',
          'Please select a valid GGUF model file (with .gguf extension)'
        );
        return;
      }

      setIsLoading(true);
      
      try {
        const isAndroidContentUri = Platform.OS === 'android' && file.uri.startsWith('content://');
        
        if (isAndroidContentUri) {
          Alert.alert(
            'Importing Model',
            'The model file needs to be copied to the app directory to work properly. This may take a while for large models.',
            [
              {
                text: 'Continue',
                onPress: async () => {
                  try {
                    await modelDownloader.linkExternalModel(file.uri, file.name);
                    setIsLoading(false);
                    Alert.alert(
                      'Model Imported',
                      'The model has been successfully imported. Consider deleting the original file from your device to save space.'
                    );
                    await loadStoredModels();
                  } catch (error) {
                    setIsLoading(false);
                    console.error('[ModelScreen] Error importing model:', error);
                    Alert.alert(
                      'Error',
                      `Failed to import the model: ${error instanceof Error ? error.message : 'Unknown error'}`
                    );
                  }
                }
              },
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => setIsLoading(false)
              }
            ]
          );
        } else {
          await modelDownloader.linkExternalModel(file.uri, file.name);
          setIsLoading(false);
          Alert.alert(
            'Model Linked',
            'The model has been successfully linked to the app. It will remain in its original location.'
          );
          await loadStoredModels();
        }
      } catch (error) {
        setIsLoading(false);
        console.error('[ModelScreen] Error linking model:', error);
        Alert.alert(
          'Error',
          `Failed to link the model: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } catch (error) {
      setIsLoading(false);
      console.error('[ModelScreen] Error picking document:', error);
      Alert.alert(
        'Error',
        'Failed to access the file. Please try again or choose a different file.'
      );
    }
  };

  const handleCustomDownload = async (downloadId: number, modelName: string) => {
    navigation.navigate('Downloads');
    
    setDownloadProgress(prev => ({
      ...prev,
      [modelName.split('/').pop() || modelName]: {
        progress: 0,
        bytesDownloaded: 0,
        totalBytes: 0,
        status: 'starting',
        downloadId
      }
    }));
    
    setCustomUrlDialogVisible(false);
  };

  const cancelDownload = async (downloadId: number, modelName: string) => {
    try {
      await modelDownloader.cancelDownload(downloadId);
      
      setDownloadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[modelName];
        return newProgress;
      });
      
      await loadStoredModels();
    } catch (error) {
      console.error('Error canceling download:', error);
      Alert.alert('Error', 'Failed to cancel download');
    }
  };

  const DownloadableModelList = ({ 
    downloadProgress, 
    setDownloadProgress
  }: { 
    downloadProgress: DownloadProgress;
    setDownloadProgress: React.Dispatch<React.SetStateAction<DownloadProgress>>;
  }) => {
    const { theme: currentTheme } = useTheme();
    const themeColors = theme[currentTheme as 'light' | 'dark'];
    const [downloadingModels, setDownloadingModels] = useState<{ [key: string]: boolean }>({});
    const [initializingDownloads, setInitializingDownloads] = useState<{ [key: string]: boolean }>({});

    const isModelDownloaded = (modelName: string) => {
      return storedModels.some(storedModel => {
        const storedModelName = storedModel.name.split('.')[0];
        const downloadableModelName = modelName.split('.')[0];
        return storedModelName.toLowerCase() === downloadableModelName.toLowerCase();
      });
    };

    const handleBrowserDownload = async (url: string) => {
      try {
        await Linking.openURL(url);
      } catch (error) {
        console.error('Error opening URL:', error);
        Alert.alert('Error', 'Could not open the download link');
      }
    };

    const handleDownload = async (model: DownloadableModel) => {
      if (isModelDownloaded(model.name)) {
        Alert.alert(
          'Model Already Downloaded',
          'This model is already in your stored models.',
          [{ text: 'OK' }]
        );
        return;
      }

      navigation.navigate('Downloads');
      
      try {
        setInitializingDownloads(prev => ({ ...prev, [model.name]: true }));
        
        setDownloadProgress(prev => ({
          ...prev,
          [model.name]: {
            progress: 0,
            bytesDownloaded: 0,
            totalBytes: 0,
            status: 'starting',
            downloadId: 0
          }
        }));
        
        const { downloadId } = await modelDownloader.downloadModel(
          model.huggingFaceLink, 
          model.name
        );
        
        setDownloadProgress(prev => ({
          ...prev,
          [model.name]: {
            ...prev[model.name],
            downloadId
          }
        }));

      } catch (error) {
        console.error('Download error:', error);
        setDownloadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[model.name];
          return newProgress;
        });
        Alert.alert('Error', 'Failed to start download');
      } finally {
        setInitializingDownloads(prev => ({ ...prev, [model.name]: false }));
      }
    };

    return (
      <ScrollView 
        style={styles.downloadableContainer}
        contentContainerStyle={styles.downloadableList}
        showsVerticalScrollIndicator={false}
      >
        {DOWNLOADABLE_MODELS.map(model => {
          const isDownloaded = isModelDownloaded(model.name);
          return (
            <View 
              key={model.name} 
              style={[styles.downloadableCard, { backgroundColor: themeColors.borderColor }]}
            >
              <View style={styles.downloadableInfo}>
                <View style={styles.modelHeader}>
                  <View style={styles.modelTitleContainer}>
                    <Text style={[styles.downloadableName, { color: themeColors.text }]}>
                      {model.name.replace(/ \([^)]+\)$/, '')}
                    </Text>
                    <View style={styles.modelBadgesContainer}>
                      <View style={[styles.modelFamily, { backgroundColor: getThemeAwareColor('#4a0660', currentTheme) }]}>
                        <Text style={styles.modelFamilyText}>{model.modelFamily}</Text>
                      </View>
                      <View style={[styles.modelQuantization, { backgroundColor: getThemeAwareColor('#2c7fb8', currentTheme) }]}>
                        <Text style={styles.modelQuantizationText}>{model.quantization}</Text>
                      </View>
                      {model.tags?.includes('fastest') && (
                        <View style={[styles.modelTag, { backgroundColor: getThemeAwareColor('#00a67e', currentTheme) }]}>
                          <MaterialCommunityIcons name="flash" size={12} color={themeColors.headerText} style={{ marginRight: 4 }} />
                          <Text style={styles.modelTagText}>Fastest</Text>
                        </View>
                      )}
                      {model.tags?.includes('recommended') && (
                        <View style={[styles.modelTag, { backgroundColor: getThemeAwareColor('#FF8C00', currentTheme) }]}>
                          <MaterialCommunityIcons name="star" size={12} color={themeColors.headerText} style={{ marginRight: 4 }} />
                          <Text style={styles.modelTagText}>Recommended</Text>
                        </View>
                      )}
                      {isDownloaded && (
                        <View style={[styles.modelTag, { backgroundColor: getThemeAwareColor('#666', currentTheme) }]}>
                          <MaterialCommunityIcons name="check" size={12} color={themeColors.headerText} style={{ marginRight: 4 }} />
                          <Text style={styles.modelTagText}>Downloaded</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.downloadButtonsContainer}>
                    <TouchableOpacity
                      style={[
                        styles.downloadButton, 
                        { backgroundColor: '#4a0660' },
                        (downloadingModels[model.name] || downloadProgress[model.name] || initializingDownloads[model.name] || isDownloaded) && { opacity: 0.5 }
                      ]}
                      onPress={() => handleDownload(model)}
                      disabled={Boolean(downloadingModels[model.name] || downloadProgress[model.name] || initializingDownloads[model.name] || isDownloaded)}
                    >
                      <MaterialCommunityIcons 
                        name={
                          isDownloaded
                            ? "check"
                            : initializingDownloads[model.name] 
                              ? "sync" 
                              : downloadingModels[model.name] || downloadProgress[model.name] 
                                ? "timer-sand" 
                                : "cloud-download"
                        } 
                        size={20} 
                        color="#fff" 
                      />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.modelMetaInfo}>
                  <View style={styles.metaItem}>
                    <MaterialCommunityIcons name="disc" size={16} color={themeColors.secondaryText} />
                    <Text style={[styles.metaText, { color: themeColors.secondaryText }]}>
                      {model.size}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.browserDownloadButton}
                    onPress={() => handleBrowserDownload(model.huggingFaceLink)}
                  >
                    <MaterialCommunityIcons name="open-in-new" size={14} color={getBrowserDownloadTextColor(currentTheme)} style={{ marginRight: 4 }} />
                    <Text style={[styles.browserDownloadText, { color: getBrowserDownloadTextColor(currentTheme) }]}>Download in browser</Text>
                  </TouchableOpacity>
                </View>
                
                {model.description && (
                  <Text style={[styles.modelDescription, { color: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.75)' }]}>
                    {model.description}
                  </Text>
                )}
                
                {downloadProgress[model.name] && downloadProgress[model.name].status !== 'completed' && downloadProgress[model.name].status !== 'failed' && (
                  <View style={styles.downloadProgress}>
                    <Text style={[styles.modelDetails, { color: themeColors.secondaryText }]}>
                      {getProgressText(downloadProgress[model.name])}
                    </Text>
                    <View style={[styles.progressBar, { backgroundColor: themeColors.background }]}>
                      <View 
                        style={[
                          styles.progressFill, 
                          { 
                            width: `${downloadProgress[model.name].progress}%`, 
                            backgroundColor: '#4a0660' 
                          }
                        ]} 
                      />
                    </View>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    );
  };

  const DownloadsDialog = ({ 
    visible, 
    onClose, 
    downloads
  }: { 
    visible: boolean; 
    onClose: () => void; 
    downloads: DownloadProgress;
    setDownloadProgress: React.Dispatch<React.SetStateAction<DownloadProgress>>;
  }) => {
    const { theme: currentTheme } = useTheme();
    const themeColors = theme[currentTheme as 'light' | 'dark'];

    const activeDownloads = Object.entries(downloads).filter(([_, value]) => 
      value.status !== 'completed' && value.status !== 'failed'
    );

    const handleDialogCancel = async (modelName: string) => {
      try {
        const downloadInfo = downloads[modelName];
        if (!downloadInfo) {
          throw new Error('Download information not found');
        }
        
        await cancelDownload(downloadInfo.downloadId, modelName);
      } catch (error) {
        console.error('Error cancelling download:', error);
        Alert.alert('Error', 'Failed to cancel download');
      }
    };

    return (
      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={onClose}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={onClose}
        >
          <View style={[styles.modalContent, { backgroundColor: themeColors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>
                Active Downloads ({activeDownloads.length})
              </Text>
              <TouchableOpacity onPress={onClose}>
                <MaterialCommunityIcons name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
            </View>
            
            {activeDownloads.length === 0 ? (
              <Text style={styles.emptyText}>
                No active downloads
              </Text>
            ) : (
              activeDownloads.map(([name, data]) => (
                <View key={name} style={styles.downloadItem}>
                  <View style={styles.downloadItemHeader}>
                    <Text style={[styles.downloadItemName, { color: themeColors.text }]}>
                      {name}
                    </Text>
                    <TouchableOpacity 
                      style={styles.cancelDownloadButton}
                      onPress={() => handleDialogCancel(name)}
                    >
                      <MaterialCommunityIcons name="close-circle" size={24} color={getThemeAwareColor('#ff4444', currentTheme)} />
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.downloadItemProgress, { color: themeColors.secondaryText }]}>
                    {getProgressText(data)}
                  </Text>
                  <View style={[styles.progressBar, { backgroundColor: themeColors.borderColor }]}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { width: `${data.progress}%`, backgroundColor: '#4a0660' }
                      ]} 
                    />
                  </View>
                </View>
              ))
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  const loadStoredModels = async () => {
    console.log('[ModelScreen] Loading stored models...');
    try {
      try {
        console.log('[ModelScreen] Checking for background downloads...');
        await modelDownloader.checkBackgroundDownloads();
        console.log('[ModelScreen] Background downloads check completed');
      } catch (checkError) {
        console.error('[ModelScreen] Error checking background downloads:', checkError);
      }
      
      console.log('[ModelScreen] Getting stored models from modelDownloader...');
      const models = await modelDownloader.getStoredModels();
      setStoredModels(models);
    } catch (error) {
      console.error('[ModelScreen] Error loading stored models:', error);
      Alert.alert(
        'Error Loading Models',
        'There was a problem loading your stored models. Please try again.'
      );
    }
  };

  const loadApiKeys = async () => {
    setIsLoadingApiKeys(true);
    try {
      const geminiKey = await onlineModelService.getApiKey('gemini');
      setGeminiApiKey(geminiKey || '');
      
      const openAIKey = await onlineModelService.getApiKey('chatgpt');
      setOpenAIApiKey(openAIKey || '');
      
      const deepSeekKey = await onlineModelService.getApiKey('deepseek');
      setDeepSeekApiKey(deepSeekKey || '');
      
      const claudeKey = await onlineModelService.getApiKey('claude');
      setClaudeApiKey(claudeKey || '');
    } catch (error) {
      console.error('Error loading API keys:', error);
    } finally {
      setIsLoadingApiKeys(false);
    }
  };

  const saveGeminiApiKey = async () => {
    try {
      if (geminiApiKey.trim()) {
        await onlineModelService.saveApiKey('gemini', geminiApiKey.trim());
        Alert.alert('Success', 'Gemini API key saved successfully');
      } else {
        await onlineModelService.clearApiKey('gemini');
        Alert.alert('Success', 'Gemini API key cleared');
      }
    } catch (error) {
      console.error('Error saving Gemini API key:', error);
      Alert.alert('Error', 'Failed to save Gemini API key');
    }
  };

  const saveOpenAIApiKey = async () => {
    try {
      if (openAIApiKey.trim()) {
        await onlineModelService.saveApiKey('chatgpt', openAIApiKey.trim());
        Alert.alert('Success', 'OpenAI API key saved successfully');
      } else {
        await onlineModelService.clearApiKey('chatgpt');
        Alert.alert('Success', 'OpenAI API key cleared');
      }
    } catch (error) {
      console.error('Error saving OpenAI API key:', error);
      Alert.alert('Error', 'Failed to save OpenAI API key');
    }
  };

  const saveDeepSeekApiKey = async () => {
    try {
      if (deepSeekApiKey.trim()) {
        await onlineModelService.saveApiKey('deepseek', deepSeekApiKey.trim());
        Alert.alert('Success', 'DeepSeek API key saved successfully');
      } else {
        await onlineModelService.clearApiKey('deepseek');
        Alert.alert('Success', 'DeepSeek API key cleared');
      }
    } catch (error) {
      console.error('Error saving DeepSeek API key:', error);
      Alert.alert('Error', 'Failed to save DeepSeek API key');
    }
  };

  const saveClaudeApiKey = async () => {
    try {
      if (claudeApiKey.trim()) {
        await onlineModelService.saveApiKey('claude', claudeApiKey.trim());
        Alert.alert('Success', 'Claude API key saved successfully');
      } else {
        await onlineModelService.clearApiKey('claude');
        Alert.alert('Success', 'Claude API key cleared');
      }
    } catch (error) {
      console.error('Error saving Claude API key:', error);
      Alert.alert('Error', 'Failed to save Claude API key');
    }
  };

  useEffect(() => {
    const handleProgress = async ({ modelName, ...progress }: { 
      modelName: string;
      progress: number;
      bytesDownloaded: number;
      totalBytes: number;
      status: string;
      downloadId: number;
      error?: string;
    }) => {
      const filename = modelName.split('/').pop() || modelName;
      
      console.log(`[ModelScreen] Download progress for ${filename}:`, progress.status, progress.progress);
      
      const bytesDownloaded = typeof progress.bytesDownloaded === 'number' ? progress.bytesDownloaded : 0;
      const totalBytes = typeof progress.totalBytes === 'number' ? progress.totalBytes : 0;
      const progressValue = typeof progress.progress === 'number' ? progress.progress : 0;

      if (progress.status === 'completed') {
        console.log(`[ModelScreen] Download completed for ${filename}`);
        
        if (Platform.OS === 'android') {
          await downloadNotificationService.showNotification(
            filename,
            progress.downloadId,
            100
          );
        }
        
        setDownloadProgress(prev => ({
          ...prev,
          [filename]: {
            progress: 100,
            bytesDownloaded,
            totalBytes,
            status: 'completed',
            downloadId: progress.downloadId
          }
        }));
        
        await loadStoredModels();
        
        setTimeout(() => {
          setDownloadProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[filename];
            return newProgress;
          });
        }, 1000);
      } else if (progress.status === 'failed') {
        console.log(`[ModelScreen] Download failed for ${filename}:`, progress.error);
        
        if (Platform.OS === 'android') {
          await downloadNotificationService.cancelNotification(progress.downloadId);
        }
        
        setDownloadProgress(prev => ({
          ...prev,
          [filename]: {
            progress: 0,
            bytesDownloaded: 0,
            totalBytes: 0,
            status: 'failed',
            downloadId: progress.downloadId,
            error: progress.error
          }
        }));
        
        setTimeout(() => {
          setDownloadProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[filename];
            return newProgress;
          });
        }, 1000);
      } else {
        if (Platform.OS === 'android') {
          await downloadNotificationService.updateProgress(
            progress.downloadId,
            progressValue
          );
        }

        setDownloadProgress(prev => ({
          ...prev,
          [filename]: {
            progress: progressValue,
            bytesDownloaded,
            totalBytes,
            status: progress.status,
            downloadId: progress.downloadId
          }
        }));
      }
    };

    const setupNotifications = async () => {
      if (Platform.OS === 'android') {
        await downloadNotificationService.requestPermissions();
      }
      await registerBackgroundTask();
    };

    loadStoredModels();
    
    modelDownloader.on('downloadProgress', handleProgress);
    
    modelDownloader.on('modelsChanged', loadStoredModels);
    
    setupNotifications();
    
    return () => {
      modelDownloader.off('downloadProgress', handleProgress);
      modelDownloader.off('modelsChanged', loadStoredModels);
    };
  }, []);

  useEffect(() => {
    const activeCount = getActiveDownloadsCount(downloadProgress);
    if (activeCount > 0) {
      Animated.sequence([
        Animated.timing(buttonScale, {
          toValue: 1.2,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(buttonScale, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [downloadProgress]);

  const handleDelete = (model: StoredModel) => {
    console.log(`[ModelScreen] Attempting to delete model: ${model.name}, path: ${model.path}`);
    
    if (model.isExternal) {
      try {
        console.log(`[ModelScreen] Removing linkage for external model: ${model.name}`);
        modelDownloader.deleteModel(model.path);
        loadStoredModels();
      } catch (error) {
        console.error(`[ModelScreen] Error removing linkage for model ${model.name}:`, error);
        Alert.alert('Error', 'Failed to remove model linkage');
      }
    } else {
      Alert.alert(
        'Delete Model',
        `Are you sure you want to delete ${model.name}?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                console.log(`[ModelScreen] User confirmed deletion of model: ${model.name}`);
                await modelDownloader.deleteModel(model.path);
                console.log(`[ModelScreen] Model deleted, refreshing stored models list`);
                await loadStoredModels();
              } catch (error) {
                console.error(`[ModelScreen] Error deleting model ${model.name}:`, error);
                Alert.alert('Error', 'Failed to delete model');
              }
            },
          },
        ]
      );
    }
  };

  const getDisplayName = (filename: string) => {
    return filename.split('.')[0];
  };

  const renderDownloadableList = () => (
    <View style={styles.downloadableContainer}>
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.apiKeysContainer}>
          <Text style={[styles.apiKeysTitle, { color: themeColors.text }]}>
            API Keys for Online Models
          </Text>
          
          <View style={styles.apiKeyContainer}>
            <Text style={[styles.apiKeyLabel, { color: themeColors.text }]}>
              Gemini API Key
            </Text>
            <TextInput
              style={[
                styles.apiKeyInput,
                { 
                  color: themeColors.text,
                  backgroundColor: themeColors.borderColor,
                  borderColor: themeColors.borderColor
                }
              ]}
              placeholder="Enter Gemini API key"
              placeholderTextColor={themeColors.secondaryText}
              value={geminiApiKey}
              onChangeText={setGeminiApiKey}
              autoCapitalize="none"
              secureTextEntry={true}
            />
            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: themeColors.primary }
              ]}
              onPress={saveGeminiApiKey}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
            <Text style={[styles.apiKeyHelp, { color: themeColors.secondaryText }]}>
              Get your Gemini API key from https://ai.google.dev/
            </Text>
          </View>

          <View style={[styles.apiKeyContainer, { marginTop: 20 }]}>
            <Text style={[styles.apiKeyLabel, { color: themeColors.text }]}>
              OpenAI API Key
            </Text>
            <TextInput
              style={[
                styles.apiKeyInput,
                { 
                  color: themeColors.text,
                  backgroundColor: themeColors.borderColor,
                  borderColor: themeColors.borderColor
                }
              ]}
              placeholder="Enter OpenAI API key"
              placeholderTextColor={themeColors.secondaryText}
              value={openAIApiKey}
              onChangeText={setOpenAIApiKey}
              autoCapitalize="none"
              secureTextEntry={true}
            />
            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: themeColors.primary }
              ]}
              onPress={saveOpenAIApiKey}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
            <Text style={[styles.apiKeyHelp, { color: themeColors.secondaryText }]}>
              Get your OpenAI API key from https://platform.openai.com/api-keys
            </Text>
          </View>

          <View style={[styles.apiKeyContainer, { marginTop: 20 }]}>
            <Text style={[styles.apiKeyLabel, { color: themeColors.text }]}>
              DeepSeek API Key
            </Text>
            <TextInput
              style={[
                styles.apiKeyInput,
                { 
                  color: themeColors.text,
                  backgroundColor: themeColors.borderColor,
                  borderColor: themeColors.borderColor
                }
              ]}
              placeholder="Enter DeepSeek API key"
              placeholderTextColor={themeColors.secondaryText}
              value={deepSeekApiKey}
              onChangeText={setDeepSeekApiKey}
              autoCapitalize="none"
              secureTextEntry={true}
            />
            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: themeColors.primary }
              ]}
              onPress={saveDeepSeekApiKey}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
            <Text style={[styles.apiKeyHelp, { color: themeColors.secondaryText }]}>
              Get your DeepSeek API key from https://platform.deepseek.com
            </Text>
          </View>

          <View style={[styles.apiKeyContainer, { marginTop: 20 }]}>
            <Text style={[styles.apiKeyLabel, { color: themeColors.text }]}>
              Claude API Key
            </Text>
            <TextInput
              style={[
                styles.apiKeyInput,
                { 
                  color: themeColors.text,
                  backgroundColor: themeColors.borderColor,
                  borderColor: themeColors.borderColor
                }
              ]}
              placeholder="Enter Claude API key"
              placeholderTextColor={themeColors.secondaryText}
              value={claudeApiKey}
              onChangeText={setClaudeApiKey}
              autoCapitalize="none"
              secureTextEntry={true}
            />
            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: themeColors.primary }
              ]}
              onPress={saveClaudeApiKey}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
            <Text style={[styles.apiKeyHelp, { color: themeColors.secondaryText }]}>
              Get your Claude API key from https://console.anthropic.com/
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.customUrlButton, { backgroundColor: themeColors.borderColor }, { marginBottom: 25 }]}
          onPress={() => setCustomUrlDialogVisible(true)}
        >
          <View style={styles.customUrlButtonContent}>
            <View style={styles.customUrlIconContainer}>
              <MaterialCommunityIcons name="plus-circle-outline" size={24} color={getThemeAwareColor('#4a0660', currentTheme)} />
            </View>
            <View style={styles.customUrlTextContainer}>
              <Text style={[styles.customUrlButtonTitle, { color: themeColors.text }]}>
                Download from URL
              </Text>
              <Text style={[styles.customUrlButtonSubtitle, { color: themeColors.secondaryText }]}>
                Download a custom GGUF model from a URL
              </Text>
            </View>
          </View>
        </TouchableOpacity>
        
        <DownloadableModelList 
          downloadProgress={downloadProgress}
          setDownloadProgress={setDownloadProgress}
        />

        <CustomUrlDialog
          visible={customUrlDialogVisible}
          onClose={() => setCustomUrlDialogVisible(false)}
          onDownloadStart={handleCustomDownload}
          navigation={navigation}
        />
      </ScrollView>
    </View>
  );

  const StoredModelsHeader = () => (
    <View style={styles.storedModelsHeader}>
      <TouchableOpacity
        style={[styles.customUrlButton, { backgroundColor: themeColors.borderColor }]}
        onPress={handleLinkModel}
      >
        <View style={styles.customUrlButtonContent}>
          <View style={styles.customUrlIconContainer}>
            <MaterialCommunityIcons name="link" size={24} color={getThemeAwareColor('#4a0660', currentTheme)} />
          </View>
          <View style={styles.customUrlTextContainer}>
            <Text style={[styles.customUrlButtonTitle, { color: themeColors.text }]}>
              Import Model
            </Text>
            <Text style={[styles.customUrlButtonSubtitle, { color: themeColors.secondaryText }]}>
              Import a GGUF model from the storage
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderItem = ({ item }: { item: StoredModel }) => {
    const displayName = getDisplayName(item.name);
    const formattedSize = formatBytes(item.size);
    
    return (
      <View style={[styles.modelItem, { backgroundColor: themeColors.borderColor }]}>
        <View style={styles.modelIconContainer}>
          <MaterialCommunityIcons 
            name={item.isExternal ? "link" : "file-document-outline"} 
            size={24} 
            color={item.isExternal ? 
              getThemeAwareColor("#4a90e2", currentTheme) : 
              getDocumentIconColor(currentTheme)
            }
          />
        </View>
        <View style={styles.modelInfo}>
          <View style={styles.modelHeader}>
            <Text style={[styles.modelName, { color: themeColors.text }]} numberOfLines={1}>
              {displayName}
            </Text>
            {item.isExternal ? (
              <View style={styles.externalBadgeContainer}>
                <MaterialCommunityIcons name="link" size={12} color="white" style={{ marginRight: 4 }} />
                <Text style={styles.externalBadgeText}>External</Text>
              </View>
            ) : ( 
            <></>
            )}
          </View>
          <View style={styles.modelMetaInfo}>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="disc" size={14} color={themeColors.secondaryText} />
              <Text style={[styles.metaText, { color: themeColors.secondaryText }]}>
                {formattedSize}
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.deleteButton, { backgroundColor: 'transparent' }]}
          onPress={() => handleDelete(item)}
        >
          <MaterialCommunityIcons name="delete-outline" size={20} color={getThemeAwareColor('#ff4444', currentTheme)} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderDownloadsButton = () => {
    const activeCount = getActiveDownloadsCount(downloadProgress);
    if (activeCount === 0) return null;

    return (
      <Animated.View 
        style={[
          styles.floatingButton,
          { transform: [{ scale: buttonScale }] }
        ]}
      >
        <TouchableOpacity
          style={[styles.floatingButtonContent, { backgroundColor: themeColors.primary }]}
          onPress={() => navigation.navigate('Downloads')}
        >
          <MaterialCommunityIcons name="cloud-download" size={24} color={themeColors.headerText} />
          <View style={styles.downloadCount}>
            <Text style={styles.downloadCountText}>{activeCount}</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  useFocusEffect(
    React.useCallback(() => {
      console.log('[ModelScreen] Screen focused, refreshing models');
      
      const refreshModels = async () => {
        try {
          await modelDownloader.processCompletedDownloads();
          
          await loadStoredModels();
        } catch (error) {
          console.error('[ModelScreen] Error refreshing models on focus:', error);
        }
      };
      
      refreshModels();
      
      return () => {
        console.log('[ModelScreen] Screen unfocused');
      };
    }, [])
  );

  useEffect(() => {
    if (activeTab === 'stored') {
      console.log('[ModelScreen] Tab changed to stored, refreshing models');
      loadStoredModels();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'stored') {
      console.log('[ModelScreen] Setting up periodic refresh for stored models');
      
      const intervalId = setInterval(async () => {
        try {
          console.log('[ModelScreen] Periodic refresh checking for new models');
          await modelDownloader.processCompletedDownloads();
          await loadStoredModels();
        } catch (error) {
          console.error('[ModelScreen] Error in periodic refresh:', error);
        }
      }, 3000);
      
      return () => {
        console.log('[ModelScreen] Clearing periodic refresh interval');
        clearInterval(intervalId);
      };
    }
  }, [activeTab]);

  useEffect(() => {
    const handleImportProgress = (progress: { 
      modelName: string; 
      status: 'importing' | 'completed' | 'error';
      error?: string;
    }) => {
      console.log('[ModelScreen] Import progress:', progress);
      if (progress.status === 'importing') {
        setImportingModelName(progress.modelName);
      } else {
        setImportingModelName(null);
        if (progress.status === 'error' && progress.error) {
          Alert.alert('Error', `Failed to import model: ${progress.error}`);
        }
      }
    };

    modelDownloader.on('importProgress', handleImportProgress);

    return () => {
      modelDownloader.off('importProgress', handleImportProgress);
    };
  }, []);

  useEffect(() => {
    loadApiKeys();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <AppHeader />
      <View style={styles.content}>
        <View style={styles.tabContainer}>
          <View style={[styles.segmentedControl, { backgroundColor: themeColors.borderColor }]}>
            <TouchableOpacity
              style={[
                styles.segmentButton,
                { borderColor: themeColors.primary },
                activeTab === 'stored' && styles.activeSegment,
                activeTab === 'stored' && { backgroundColor: themeColors.primary }
              ]}
              onPress={() => setActiveTab('stored')}
            >
              <MaterialCommunityIcons 
                name="folder" 
                size={18} 
                color={activeTab === 'stored' ? '#fff' : themeColors.text} 
                style={styles.segmentIcon}
              />
              <Text style={[
                styles.segmentText,
                { color: activeTab === 'stored' ? '#fff' : themeColors.text }
              ]}>
                Stored Models
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.segmentButton,
                { borderColor: themeColors.primary },
                activeTab === 'downloadable' && styles.activeSegment,
                activeTab === 'downloadable' && { backgroundColor: themeColors.primary }
              ]}
              onPress={() => setActiveTab('downloadable')}
            >
              <MaterialCommunityIcons 
                name="cloud-download" 
                size={18} 
                color={activeTab === 'downloadable' ? '#fff' : themeColors.text}
                style={styles.segmentIcon}
              />
              <Text style={[
                styles.segmentText,
                { color: activeTab === 'downloadable' ? '#fff' : themeColors.text }
              ]}>
                Download Models
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.contentContainer}>
          {activeTab === 'stored' ? (
            <FlatList
              data={storedModels}
              renderItem={renderItem}
              keyExtractor={item => item.path}
              contentContainerStyle={styles.list}
              ListHeaderComponent={StoredModelsHeader}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <MaterialCommunityIcons 
                    name="folder-open" 
                    size={48} 
                    color={themeColors.secondaryText}
                  />
                  <Text style={[styles.emptyText, { color: themeColors.secondaryText }]}>
                    No models downloaded yet. Go to the "Download Models" tab to get started.
                  </Text>
                </View>
              }
            />
          ) : (
            renderDownloadableList()
          )}
        </View>
      </View>
      {renderDownloadsButton()}
      
      <DownloadsDialog
        visible={isDownloadsVisible}
        onClose={() => setIsDownloadsVisible(false)}
        downloads={downloadProgress}
        setDownloadProgress={setDownloadProgress}
      />

      {(isLoading || importingModelName) && (
        <View style={styles.loadingOverlay}>
          <View style={[styles.loadingContainer, { backgroundColor: themeColors.borderColor }]}>
            <ActivityIndicator size="large" color={getThemeAwareColor('#4a0660', currentTheme)} />
            <Text style={[styles.loadingText, { color: themeColors.text }]}>
              {importingModelName ? `Importing ${importingModelName}...` : 'Importing model...'}
            </Text>
            <Text style={[styles.loadingSubtext, { color: themeColors.secondaryText }]}>
              {importingModelName ? 'Moving model to app storage' : 'This may take a while for large models'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 16,
    marginTop: 8,
  },
  list: {
    padding: 16,
    paddingTop: 8,
  },
  modelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  modelInfo: {
    flex: 1,
    gap: 4,
  },
  modelName: {
    fontSize: 16,
    fontWeight: '500',
  },
  modelDetails: {
    fontSize: 14,
    opacity: 0.7,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 12,
  },
  tabContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginTop: 8,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeSegment: {
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
  },
  segmentIcon: {
    marginRight: 6,
  },
  contentContainer: {
    flex: 1,
    paddingTop: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    marginTop: 8,
  },
  downloadableList: {
    padding: 16,
    paddingTop: 0,
  },
  downloadableCard: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  downloadableInfo: {
    padding: 16,
  },
  modelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modelTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingRight: 12,
  },
  downloadableName: {
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
    marginBottom: 4,
  },
  modelBadgesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  modelFamily: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  modelFamilyText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  modelQuantization: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  modelQuantizationText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  downloadButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  browserDownloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  browserDownloadText: {
    fontSize: 13,
    fontWeight: '500',
  },
  downloadButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  modelMetaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 13,
    marginLeft: 4,
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 8,
  },
  viewMoreButtonText: {
    fontSize: 14,
    marginLeft: 4,
  },
  downloadProgress: {
    marginTop: 12,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    width: '100%',
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  downloadItem: {
    marginBottom: 16,
  },
  downloadItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  downloadItemName: {
    fontSize: 16,
    fontWeight: '500',
  },
  downloadItemProgress: {
    fontSize: 14,
    marginBottom: 8,
  },
  cancelDownloadButton: {
    padding: 4,
  },
  customUrlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  customUrlButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customUrlIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(74, 6, 96, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  customUrlTextContainer: {
    flex: 1,
  },
  customUrlButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  customUrlButtonSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingContainer: {
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    width: '80%',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  loadingSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  downloadableContainer: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  storedModelsHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  modelDescription: {
    marginTop: 4,
    marginBottom: 6,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  modelItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  modelIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(74, 6, 96, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  externalBadgeContainer: {
    backgroundColor: '#4a90e2',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  externalBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  floatingButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4a0660',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  downloadCount: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ff4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  downloadCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  floatingButtonContent: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  modelTagText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  apiKeysContainer: {
    marginBottom: 25,
    padding: 16,
    backgroundColor: 'rgba(150, 150, 150, 0.08)',
    borderRadius: 12,
  },
  apiKeysTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  apiKeyContainer: {
    marginBottom: 8,
  },
  apiKeyLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  apiKeyInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  saveButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  apiKeyHelp: {
    fontSize: 14,
    marginTop: 2,
  },
}); 