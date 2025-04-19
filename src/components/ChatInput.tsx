import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../context/ThemeContext';
import { theme } from '../constants/theme';
import { getThemeAwareColor } from '../utils/ColorUtils';
import PDFViewerModal from './PDFViewerModal';

type ChatInputProps = {
  onSend: (text: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
  onCancel?: () => void;
  style?: any;
  placeholderColor?: string;
};

export default function ChatInput({ 
  onSend, 
  disabled = false,
  isLoading = false,
  onCancel = () => {},
  style = {},
  placeholderColor = 'rgba(0, 0, 0, 0.6)'
}: ChatInputProps) {
  const [text, setText] = useState('');
  const [inputHeight, setInputHeight] = useState(48);
  const [pdfModalVisible, setPdfModalVisible] = useState(false);
  const [selectedPdfUri, setSelectedPdfUri] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const { theme: currentTheme } = useTheme();
  const themeColors = theme[currentTheme as 'light' | 'dark'];
  const isDark = currentTheme === 'dark';

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text);
    setText('');
    setInputHeight(48);
  };

  const handleContentSizeChange = (event: any) => {
    const height = Math.min(120, Math.max(48, event.nativeEvent.contentSize.height));
    setInputHeight(height);
  };

  const pickPdfDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const pdfUri = result.assets[0].uri;
        setSelectedPdfUri(pdfUri);
        setPdfModalVisible(true);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Could not pick the document. Please try again.');
    }
  };

  const closePdfModal = () => {
    setPdfModalVisible(false);
  };

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity 
        style={styles.attachmentButton} 
        onPress={pickPdfDocument}
        disabled={disabled}
      >
        <MaterialCommunityIcons 
          name="attachment" 
          size={24} 
          color={isDark ? '#ffffff' : "#660880"} 
        />
      </TouchableOpacity>

      <View style={styles.inputContainer}>
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            {
              height: inputHeight,
              color: isDark ? '#fff' : '#000',
              backgroundColor: isDark ? '#2a2a2a' : '#f1f1f1',
            },
          ]}
          placeholder="Type a message..."
          placeholderTextColor={placeholderColor}
          value={text}
          onChangeText={setText}
          onContentSizeChange={handleContentSizeChange}
          multiline
          maxLength={10000}
          editable={!disabled}
          returnKeyType="default"
        />
      </View>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="small"
            color={getThemeAwareColor('#0084ff', currentTheme)}
            style={styles.loadingIndicator}
          />
          <TouchableOpacity
            onPress={onCancel}
            style={styles.cancelButton}
          >
            <MaterialCommunityIcons 
              name="close" 
              size={24} 
              color={isDark ? '#ffffff' : "#660880"} 
            />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity 
          style={[
            styles.sendButton,
            !text.trim() && styles.sendButtonDisabled
          ]} 
          onPress={handleSend}
          disabled={!text.trim() || disabled}
        >
          <MaterialCommunityIcons 
            name="send" 
            size={24} 
            color={text.trim() ? getThemeAwareColor('#660880', currentTheme) : isDark ? themeColors.secondaryText : '#999'} 
          />
        </TouchableOpacity>
      )}

      {selectedPdfUri && (
        <PDFViewerModal
          visible={pdfModalVisible}
          onClose={closePdfModal}
          pdfSource={selectedPdfUri}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  inputContainer: {
    flex: 1,
    borderRadius: 20,
    marginRight: 8,
    overflow: 'hidden',
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    borderRadius: 20,
    minHeight: 48,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingIndicator: {
    marginRight: 8,
  },
  cancelButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  attachmentButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
}); 