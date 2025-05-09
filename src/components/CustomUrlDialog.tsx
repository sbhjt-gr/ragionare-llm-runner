import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { theme } from '../constants/theme';
import { modelDownloader } from '../services/ModelDownloader';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { TabParamList } from '../types/navigation';
import { Dialog, Portal, PaperProvider, Text, Button } from 'react-native-paper';

interface CustomUrlDialogProps {
  visible: boolean;
  onClose: () => void;
  onDownloadStart: (downloadId: number, modelName: string) => void;
  navigation: CompositeNavigationProp<
    BottomTabNavigationProp<TabParamList, 'ModelTab'>,
    NativeStackNavigationProp<RootStackParamList>
  >;
}

interface DownloadState {
  downloadId: number;
  status: string;
  modelName: string;
}

const CustomUrlDialog = ({ visible, onClose, onDownloadStart, navigation }: CustomUrlDialogProps) => {
  const { theme: currentTheme } = useTheme();
  const themeColors = theme[currentTheme as 'light' | 'dark'];
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValid, setIsValid] = useState(false);

  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogMessage, setDialogMessage] = useState('');

  const showAppDialog = (title: string, message: string) => {
    setDialogTitle(title);
    setDialogMessage(message);
    setDialogVisible(true);
  };

  const hideAppDialog = () => {
    setDialogVisible(false);
  };

  const validateUrl = (input: string) => {
    setUrl(input);
    const isValid = input.trim().length > 0 && 
      (input.startsWith('http://') || input.startsWith('https://'));
    setIsValid(isValid);
  };

  const handleDownload = async () => {
    if (!isValid) return;
    
    navigation.navigate('Downloads');
    onClose();
    
    setIsLoading(true);
    try {
      const response = await fetch(url, { method: 'HEAD' });
      const contentDisposition = response.headers.get('content-disposition');
      
      let filename = '';
      if (contentDisposition) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }

      if (!filename) {
        filename = url.split('/').pop() || 'custom_model.gguf';
      }

      if (!filename.toLowerCase().endsWith('.gguf')) {
        showAppDialog(
          'Invalid File',
          'Only direct download links to GGUF models are supported. Please make sure opening the link in a browser downloads a GGUF model file directly.'
        );
        setIsLoading(false);
        return;
      }
      
      const { downloadId } = await modelDownloader.downloadModel(url, filename);
      
      const initialProgress = {
        downloadId,
        progress: 0,
        bytesDownloaded: 0,
        totalBytes: 0,
        status: 'downloading'
      };

      const existingProgressJson = await AsyncStorage.getItem('download_progress');
      const existingProgress = existingProgressJson ? JSON.parse(existingProgressJson) : {};

      const newProgress = {
        ...existingProgress,
        [filename]: initialProgress
      };

      await AsyncStorage.setItem('download_progress', JSON.stringify(newProgress));
      
      onDownloadStart(downloadId, filename);
      setUrl('');
    } catch (error) {
      showAppDialog('Error', 'Failed to start download');
    } finally {
      setIsLoading(false);
    }
  };

  const openHuggingFace = () => {
    Linking.openURL('https://huggingface.co/models?library=gguf');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: themeColors.background }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: themeColors.text }]}>
              Download Custom Model
            </Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialCommunityIcons name="close" size={24} color={themeColors.text} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.hfLink, { backgroundColor: themeColors.borderColor }]}
            onPress={openHuggingFace}
          >
            <View style={styles.hfLinkContent}>
              <MaterialCommunityIcons name="magnify" size={18} color="#4a0660" />
              <Text style={[styles.hfLinkText, { color: themeColors.text }]}>
                Browse GGUF Models on HuggingFace
              </Text>
            </View>
            <MaterialCommunityIcons name="open-in-new" size={18} color={themeColors.secondaryText} />
          </TouchableOpacity>

          <View style={styles.warningContainer}>
            <MaterialCommunityIcons name="alert-outline" size={20} color="#4a0660" />
            <Text style={[styles.warningText, { color: themeColors.secondaryText }]}>
            Only direct download links to GGUF models are supported. Please make sure opening the link in a browser downloads a GGUF model file directly.
            </Text>
          </View>

          <View style={[styles.inputContainer, { backgroundColor: themeColors.borderColor }]}>
            <MaterialCommunityIcons name="link-variant" size={20} color={themeColors.secondaryText} />
            <TextInput
              style={[styles.input, { color: themeColors.text }]}
              placeholder="Enter model URL"
              placeholderTextColor={themeColors.secondaryText}
              value={url}
              onChangeText={validateUrl}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.downloadButton,
              { 
                backgroundColor: '#4a0660',
                opacity: isValid && !isLoading ? 1 : 0.5
              }
            ]}
            onPress={handleDownload}
            disabled={!isValid || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Start Download</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <Portal>
        <Dialog visible={dialogVisible} onDismiss={hideAppDialog}>
          <Dialog.Title>{dialogTitle}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{dialogMessage}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={hideAppDialog}>OK</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(74, 6, 96, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  warningText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    lineHeight: 18,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
  },
  downloadButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  hfLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  hfLinkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hfLinkText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default CustomUrlDialog; 