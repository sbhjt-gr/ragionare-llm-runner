import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Clipboard,
  ToastAndroid,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { theme } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import ModelSelector from '../components/ModelSelector';
import { llamaManager } from '../utils/LlamaManager';
import AppHeader from '../components/AppHeader';
import { useFocusEffect } from '@react-navigation/native';
import Markdown from 'react-native-markdown-display';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Menu, MenuItem } from 'react-native-material-menu';
import { useNavigation, RouteProp, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, TabParamList } from '../types/navigation';
import { useModel } from '../context/ModelContext';

type Message = {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  thinking?: string;
  stats?: {
    duration: number;
    tokens: number;
  };
};

type ModelMemoryInfo = {
  requiredMemory: number;
  availableMemory: number;
};

type HomeScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
  route: RouteProp<TabParamList, 'HomeTab'>;
};

const extractCodeFromFence = (content: string): string => {
  const codeMatch = content.match(/```[\s\S]*?\n([\s\S]*?)```/);
  return codeMatch ? codeMatch[1].trim() : '';
};

// Helper functions for code blocks
const hasCodeBlock = (content: string): boolean => {
  return content.includes('```') || content.includes('`');
};

const extractAllCodeBlocks = (content: string): string[] => {
  const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)```/g;
  const codeBlocks: string[] = [];
  
  let match;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    codeBlocks.push(match[1]);
  }
  
  return codeBlocks;
};

// Create custom renderers for selectable text
const createSelectableRenderer = (defaultRenderer: any) => (node: any, children: any, parent: any, styles: any) => {
  const defaultOutput = defaultRenderer(node, children, parent, styles);
  if (defaultOutput && defaultOutput.type === Text) {
    return React.cloneElement(defaultOutput, { selectable: true });
  }
  return defaultOutput;
};

// Component for code blocks
const CodeBlock = ({ content, style }: { content: string, style?: any }) => {
  const { theme: currentTheme } = useTheme();
  const themeColors = theme[currentTheme as 'light' | 'dark'];
  
  return (
    <View style={[styles.codeBlock, style]}>
      <Text 
        selectable={true}
        style={styles.codeText}
      >
        {content}
      </Text>
      <TouchableOpacity 
        style={styles.codeBlockCopyButton}
        onPress={() => Clipboard.setString(content)}
        hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
      >
        <Ionicons 
          name="copy-outline" 
          size={14} 
          color="#fff" 
        />
      </TouchableOpacity>
    </View>
  );
};

// Add this function near the other helper functions at the top of the file
const hasMarkdownFormatting = (content: string): boolean => {
  // Check for common markdown syntax
  const markdownPatterns = [
    /```/,           // Code blocks
    /`[^`]+`/,       // Inline code
    /\*\*[^*]+\*\*/,  // Bold
    /\*[^*]+\*/,      // Italic
    /^#+\s/m,         // Headers
    /\[[^\]]+\]\([^)]+\)/,  // Links
    /^\s*[-*+]\s/m,   // Unordered lists
    /^\s*\d+\.\s/m,   // Ordered lists
    /^\s*>\s/m,       // Blockquotes
    /~~[^~]+~~/,      // Strikethrough
    /\|\s*[^|]+\s*\|/  // Tables
  ];

  return markdownPatterns.some(pattern => pattern.test(content));
};

export default function HomeScreen({ route, navigation }: HomeScreenProps) {
  const { theme: currentTheme } = useTheme();
  const themeColors = theme[currentTheme as 'light' | 'dark'];
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const modelSelectorRef = useRef<{ refreshModels: () => void }>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [chatHistories, setChatHistories] = useState<{ id: string, messages: Message[], timestamp: number }[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string>(Date.now().toString());
  const [shouldOpenModelSelector, setShouldOpenModelSelector] = useState(false);
  const [preselectedModelPath, setPreselectedModelPath] = useState<string | null>(null);
  const { isModelLoading } = useModel();
  const [showCopyToast, setShowCopyToast] = useState(false);
  const copyToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const copyToastMessageRef = useRef<string>('Copied to clipboard');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const cancelGenerationRef = useRef<boolean>(false);

  useFocusEffect(
    useCallback(() => {
      modelSelectorRef.current?.refreshModels();
    }, [])
  );

  useEffect(() => {
    loadMessages();
    loadChatHistories();
  }, []);

  useEffect(() => {
    if (route.params?.chatId) {
      const selectedChat = chatHistories.find(chat => chat.id === route.params.chatId);
      if (selectedChat) {
        setCurrentChatId(route.params.chatId);
        setMessages(selectedChat.messages);
        saveMessages(selectedChat.messages);
      }
    }
  }, [route.params?.chatId, chatHistories]);

  useEffect(() => {
    if (route.params?.openModelSelector) {
      setShouldOpenModelSelector(true);
      if (route.params?.preselectedModelPath) {
        setPreselectedModelPath(route.params.preselectedModelPath);
      }
      navigation.setParams({ openModelSelector: undefined, preselectedModelPath: undefined });
    }
  }, [route.params?.openModelSelector]);

  useEffect(() => {
    return () => {
      if (copyToastTimeoutRef.current) {
        clearTimeout(copyToastTimeoutRef.current);
      }
    };
  }, []);

  const loadMessages = async () => {
    try {
      const savedMessages = await AsyncStorage.getItem('chatMessages');
      if (savedMessages) {
        setMessages(JSON.parse(savedMessages));
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const saveMessages = async (newMessages: Message[]) => {
    try {
      await AsyncStorage.setItem('chatMessages', JSON.stringify(newMessages));
    } catch (error) {
      console.error('Error saving messages:', error);
    }
  };

  const handleSend = async () => {
    if (!message.trim()) return;
    if (!llamaManager.getModelPath()) {
      alert('Please select a model first');
      return;
    }

    try {
      // Check memory before proceeding
      const memoryInfo = await llamaManager.checkMemoryRequirements();
      
      // Only show memory warning if we have valid memory info
      if (memoryInfo.requiredMemory > 0 && memoryInfo.availableMemory > 0 && 
          memoryInfo.availableMemory < memoryInfo.requiredMemory) {
        const requiredGB = (memoryInfo.requiredMemory / 1024 / 1024 / 1024).toFixed(1);
        const availableGB = (memoryInfo.availableMemory / 1024 / 1024 / 1024).toFixed(1);
        
        Alert.alert(
          'Insufficient Memory',
          `This model requires ${requiredGB}GB of RAM but only ${availableGB}GB is available. The app might crash or perform poorly. Do you want to continue?`,
          [
            {
              text: 'Cancel',
              style: 'cancel'
            },
            {
              text: 'Continue Anyway',
              onPress: () => processMessage(),
              style: 'destructive'
            }
          ]
        );
        return;
      }

      await processMessage();

    } catch (error) {
      console.error('Error:', error);
      if (error instanceof Error && error.message.includes('memory')) {
        Alert.alert(
          'Out of Memory',
          'Your device ran out of memory while processing. Try using a smaller model or closing other apps.'
        );
      } else {
        alert('Failed to generate response');
      }
    }
  };

  const handleCancelGeneration = useCallback(() => {
    cancelGenerationRef.current = true;
    // We'll let the generation loop detect this flag and stop
  }, []);

  const processMessage = async () => {
    if (!message.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: message.trim(),
      role: 'user',
    };

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      content: '',
      role: 'assistant',
      stats: {
        duration: 0,
        tokens: 0,
      },
    };

    const newMessages = [...messages, userMessage, assistantMessage];
    setMessages(newMessages);
    await saveMessages(newMessages);
    setMessage('');
    setIsLoading(true);
    cancelGenerationRef.current = false;

    const startTime = Date.now();
    let tokenCount = 0;
    let fullResponse = '';
    let thinking = '';
    let isThinking = false;

    try {
      await llamaManager.generateResponse(
        [
          {
            role: 'system',
            content: 'You are a helpful AI assistant.',
          },
          ...messages,
          userMessage,
        ].map(msg => ({ role: msg.role, content: msg.content })),
        (token) => {
          // Check if cancellation was requested
          if (cancelGenerationRef.current) {
            throw new Error('Generation cancelled by user');
          }

          tokenCount++;

          if (token.includes('<think>')) {
            isThinking = true;
            return;
          }
          if (token.includes('</think>')) {
            isThinking = false;
            return;
          }

          if (isThinking) {
            thinking += token;
          } else {
            fullResponse += token;
          }

          setMessages(prev => {
            const updated = [...prev];
            const lastMessage = updated[updated.length - 1];
            if (lastMessage.role === 'assistant') {
              updated[updated.length - 1] = {
                ...lastMessage,
                content: fullResponse,
                thinking: thinking,
                stats: {
                  duration: (Date.now() - startTime) / 1000,
                  tokens: tokenCount,
                },
              };
            }
            return updated;
          });
        }
      );

      // Final message update
      setMessages(prev => {
        const updated = [...prev];
        const lastMessage = updated[updated.length - 1];
        if (lastMessage.role === 'assistant') {
          updated[updated.length - 1] = {
            ...lastMessage,
            content: fullResponse,
            thinking: thinking,
            stats: {
              duration: (Date.now() - startTime) / 1000,
              tokens: tokenCount,
            },
          };
        }
        return updated;
      });

      await saveMessages(messages);
    } catch (error) {
      console.error('Error generating response:', error);
      
      // Only show alert if it wasn't a cancellation
      if (!cancelGenerationRef.current) {
      Alert.alert('Error', 'Failed to generate response');
      } else {
        // If cancelled, update the last message to indicate cancellation
        setMessages(prev => {
          const updated = [...prev];
          const lastMessage = updated[updated.length - 1];
          if (lastMessage.role === 'assistant') {
            updated[updated.length - 1] = {
              ...lastMessage,
              content: fullResponse + " [Cancelled]",
              thinking: thinking,
              stats: {
                duration: (Date.now() - startTime) / 1000,
                tokens: tokenCount,
              },
            };
          }
          return updated;
        });
      }
    } finally {
      setIsLoading(false);
      cancelGenerationRef.current = false;
    }
  };

  const copyToClipboard = (text: string) => {
    Clipboard.setString(text);
    if (Platform.OS === 'android') {
      ToastAndroid.show('Copied to clipboard', ToastAndroid.SHORT);
    } else {
      // Show iOS toast
      setShowCopyToast(true);
      
      // Clear any existing timeout
      if (copyToastTimeoutRef.current) {
        clearTimeout(copyToastTimeoutRef.current);
      }
      
      // Use a ref to store the toast message
      copyToastMessageRef.current = 'Copied to clipboard';
      
      // Hide toast after 2 seconds
      copyToastTimeoutRef.current = setTimeout(() => {
        setShowCopyToast(false);
      }, 2000);
    }
  };

  // Function to count code blocks in a message
  const countCodeBlocks = useCallback((content: string): number => {
    return extractAllCodeBlocks(content).length;
  }, []);

  // Function to extract and display code blocks with copy buttons
  const renderCodeBlocks = useCallback((content: string) => {
    const codeBlocks = extractAllCodeBlocks(content);
    if (codeBlocks.length === 0) return null;
    
    return (
      <View style={{ marginVertical: 8 }}>
        {codeBlocks.map((code, index) => (
          <View key={`code-${index}`} style={styles.codeBlock}>
            <Text 
              selectable={true}
              style={styles.codeText}
            >
              {code}
            </Text>
            <TouchableOpacity 
              style={styles.codeBlockCopyButton}
              onPress={() => {
                copyToClipboard(code);
                copyToastMessageRef.current = 'Code copied to clipboard';
              }}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <Ionicons 
                name="copy-outline" 
                size={14} 
                color="#fff" 
              />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  }, [copyToClipboard]);

  const handleRegenerate = async () => {
    if (messages.length < 2) return;
    
    // Check if a model is selected
    if (!llamaManager.getModelPath()) {
      Alert.alert('No Model Selected', 'Please select a model first to regenerate a response.');
      return;
    }
    
    // Get the last user message
    const lastUserMessageIndex = [...messages].reverse().findIndex(msg => msg.role === 'user');
    if (lastUserMessageIndex === -1) return;
    
    const lastUserMessage = messages[messages.length - lastUserMessageIndex - 1];
    
    // Remove the last assistant message
    const newMessages = messages.slice(0, -1);
    
    // Add a new empty assistant message
    const assistantMessage: Message = {
      id: Date.now().toString(),
      content: '',
      role: 'assistant',
      stats: {
        duration: 0,
        tokens: 0,
      },
    };
    
    const updatedMessages = [...newMessages, assistantMessage];
    setMessages(updatedMessages);
    await saveMessages(updatedMessages);
    setIsRegenerating(true);
    cancelGenerationRef.current = false;
    
    const startTime = Date.now();
    let tokenCount = 0;
    let fullResponse = '';
    let thinking = '';
    let isThinking = false;
    
    try {
      await llamaManager.generateResponse(
        [
          {
            role: 'system',
            content: 'You are a helpful AI assistant.',
          },
          ...newMessages,
        ].map(msg => ({ role: msg.role, content: msg.content })),
        (token) => {
          // Check if cancellation was requested
          if (cancelGenerationRef.current) {
            throw new Error('Generation cancelled by user');
          }
          
          tokenCount++;
          
          if (token.includes('<think>')) {
            isThinking = true;
            return;
          }
          if (token.includes('</think>')) {
            isThinking = false;
            return;
          }
          
          if (isThinking) {
            thinking += token;
          } else {
            fullResponse += token;
          }
          
          setMessages(prev => {
            const updated = [...prev];
            const lastMessage = updated[updated.length - 1];
            if (lastMessage.role === 'assistant') {
              updated[updated.length - 1] = {
                ...lastMessage,
                content: fullResponse,
                thinking: thinking,
                stats: {
                  duration: (Date.now() - startTime) / 1000,
                  tokens: tokenCount,
                },
              };
            }
            return updated;
          });
        }
      );
      
      // Final message update
      setMessages(prev => {
        const updated = [...prev];
        const lastMessage = updated[updated.length - 1];
        if (lastMessage.role === 'assistant') {
          updated[updated.length - 1] = {
            ...lastMessage,
            content: fullResponse,
            thinking: thinking,
            stats: {
              duration: (Date.now() - startTime) / 1000,
              tokens: tokenCount,
            },
          };
        }
        return updated;
      });
      
      await saveMessages(messages);
    } catch (error) {
      console.error('Error regenerating response:', error);
      
      // Only show alert if it wasn't a cancellation
      if (!cancelGenerationRef.current) {
        Alert.alert('Error', 'Failed to regenerate response');
      } else {
        // If cancelled, update the last message to indicate cancellation
        setMessages(prev => {
          const updated = [...prev];
          const lastMessage = updated[updated.length - 1];
          if (lastMessage.role === 'assistant') {
            updated[updated.length - 1] = {
              ...lastMessage,
              content: fullResponse + " [Cancelled]",
              thinking: thinking,
              stats: {
                duration: (Date.now() - startTime) / 1000,
                tokens: tokenCount,
              },
            };
          }
          return updated;
        });
      }
    } finally {
      setIsRegenerating(false);
      cancelGenerationRef.current = false;
    }
  };

  const renderMessage = useCallback(({ item }: { item: Message }) => {
    return (
    <View>
      {item.role === 'assistant' && item.thinking && (
        <View style={[styles.thinkingBubble, { backgroundColor: themeColors.borderColor }]}>
            <View style={styles.thinkingContent}>
          <Text style={[styles.thinkingText, { color: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.75)' }]}>
            Reasoning:
          </Text>
              <Text 
                style={[styles.thinkingContentText, { color: themeColors.text }]} 
                selectable={true}
              >
            {item.thinking}
          </Text>
            </View>
            
            <TouchableOpacity 
              style={styles.copyButton} 
              onPress={() => copyToClipboard(item.thinking || '')}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <Ionicons 
                name="copy-outline" 
                size={16} 
                color={currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.75)'} 
              />
            </TouchableOpacity>
        </View>
      )}
      <View
        style={[
          styles.messageBubble,
          item.role === 'user' ? styles.userMessage : styles.assistantMessage,
          {
            backgroundColor:
              item.role === 'user' ? themeColors.headerBackground : themeColors.borderColor,
          },
        ]}
      >
          <View style={styles.messageBubbleContent}>
            {/* For plain text content, use selectable Text */}
            {!hasMarkdownFormatting(item.content) ? (
              <Text 
                selectable={true} 
                style={{ 
                  color: item.role === 'user' ? '#fff' : themeColors.text,
                  fontSize: 16,
                  lineHeight: 22,
                }}
              >
                {item.content}
              </Text>
            ) : (
              /* For markdown content, use Markdown component */
              <View>
                <Text 
                  selectable={true} 
                  style={{ 
                    position: 'absolute', 
                    opacity: 0, 
                    height: 1, 
                    width: '100%',
                    zIndex: -1
                  }}
                >
                  {item.content}
                </Text>
        <Markdown
          style={{
            body: {
              color: item.role === 'user' ? '#fff' : themeColors.text,
              fontSize: 16,
              lineHeight: 22,
            },
            paragraph: {
              marginVertical: 0,
            },
                    code_block: {
                      backgroundColor: '#1e1e1e',
                      borderRadius: 8,
                      padding: 12,
                      marginVertical: 4,
                      position: 'relative',
                    },
                    fence: {
                      backgroundColor: '#1e1e1e',
                      borderRadius: 8,
                      padding: 12,
                      marginVertical: 4,
                      position: 'relative',
                    },
                    code_inline: {
                      color: '#fff',
                      backgroundColor: '#1e1e1e',
                      borderRadius: 4,
                      paddingHorizontal: 4,
                      paddingVertical: 2,
                      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                      fontSize: 12,
                    },
                    text: {
                      color: item.role === 'user' ? '#fff' : themeColors.text,
                    },
                    code_block_text: {
                      color: '#fff',
                      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                      fontSize: 12,
                    },
                    fence_text: {
                      color: '#fff',
                      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                      fontSize: 12,
                    },
                    pre: {
                      backgroundColor: '#1e1e1e',
                      color: '#fff',
                    },
                    code: {
                      color: '#fff',
                      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                    },
                    // Add styles for bold, italic, and other formatting
                    strong: {
                      fontWeight: 'bold',
                      color: item.role === 'user' ? '#fff' : themeColors.text,
                    },
                    em: {
                      fontStyle: 'italic',
                      color: item.role === 'user' ? '#fff' : themeColors.text,
                    },
                    heading1: {
                      fontSize: 24,
                      fontWeight: 'bold',
                      marginTop: 12,
                      marginBottom: 6,
                      color: item.role === 'user' ? '#fff' : themeColors.text,
                    },
                    heading2: {
                      fontSize: 22,
                      fontWeight: 'bold',
                      marginTop: 10,
                      marginBottom: 5,
                      color: item.role === 'user' ? '#fff' : themeColors.text,
                    },
                    heading3: {
                      fontSize: 20,
                      fontWeight: 'bold',
                      marginTop: 8,
                      marginBottom: 4,
                      color: item.role === 'user' ? '#fff' : themeColors.text,
                    },
                    heading4: {
                      fontSize: 18,
                      fontWeight: 'bold',
                      marginTop: 6,
                      marginBottom: 3,
                      color: item.role === 'user' ? '#fff' : themeColors.text,
                    },
                    heading5: {
                      fontSize: 17,
                      fontWeight: 'bold',
                      marginTop: 4,
                      marginBottom: 2,
                      color: item.role === 'user' ? '#fff' : themeColors.text,
                    },
                    heading6: {
                      fontSize: 16,
                      fontWeight: 'bold',
                      marginTop: 4,
                      marginBottom: 2,
                      color: item.role === 'user' ? '#fff' : themeColors.text,
                    },
                    link: {
                      color: item.role === 'user' ? '#9cc7ff' : '#0366d6',
                      textDecorationLine: 'underline',
                    },
                    blockquote: {
                      borderLeftWidth: 4,
                      borderLeftColor: item.role === 'user' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.1)',
                      paddingLeft: 8,
                      marginLeft: 8,
                      marginVertical: 4,
                    },
                    bullet_list: {
                      marginVertical: 4,
                    },
                    ordered_list: {
                      marginVertical: 4,
                    },
                    list_item: {
                      flexDirection: 'row',
                      marginVertical: 2,
                    },
                    bullet_list_icon: {
                      marginRight: 6,
                      color: item.role === 'user' ? '#fff' : themeColors.text,
                    },
                    ordered_list_icon: {
                      marginRight: 6,
                      color: item.role === 'user' ? '#fff' : themeColors.text,
                    },
                    s: {
                      textDecorationLine: 'line-through',
                      color: item.role === 'user' ? '#fff' : themeColors.text,
                    },
                    table: {
                      borderWidth: 1,
                      borderColor: item.role === 'user' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
                      borderRadius: 4,
                      marginVertical: 8,
                    },
                    thead: {
                      backgroundColor: item.role === 'user' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                    },
                    th: {
                      padding: 6,
                      fontWeight: 'bold',
                      color: item.role === 'user' ? '#fff' : themeColors.text,
                    },
                    tr: {
                      borderBottomWidth: 1,
                      borderBottomColor: item.role === 'user' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                    },
                    td: {
                      padding: 6,
                      color: item.role === 'user' ? '#fff' : themeColors.text,
                    },
          }}
          // Add custom renderers to ensure text formatting works properly
          rules={{
            strong: (node, children, parent, styles) => (
              <Text key={node.key} style={styles.strong} selectable={true}>
                {children}
              </Text>
            ),
            text: (node, children, parent, styles) => (
              <Text key={node.key} style={styles.text} selectable={true}>
                {node.content}
              </Text>
            ),
            em: (node, children, parent, styles) => (
              <Text key={node.key} style={styles.em} selectable={true}>
                {children}
              </Text>
            ),
            s: (node, children, parent, styles) => (
              <Text key={node.key} style={styles.s} selectable={true}>
                {children}
              </Text>
            ),
            code_block: (node, children, parent, styles) => (
              <View key={node.key} style={styles.code_block}>
                <Text selectable={true} style={styles.code_block_text}>
                  {node.content}
                </Text>
                <TouchableOpacity 
                  style={styles.codeBlockCopyButton}
                  onPress={() => {
                    copyToClipboard(node.content);
                    copyToastMessageRef.current = 'Code copied to clipboard';
                  }}
                  hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                >
                  <Ionicons name="copy-outline" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ),
            fence: (node, children, parent, styles) => (
              <View key={node.key} style={styles.fence}>
                <Text selectable={true} style={styles.fence_text}>
                  {node.content}
                </Text>
                <TouchableOpacity 
                  style={styles.codeBlockCopyButton}
                  onPress={() => {
                    copyToClipboard(node.content);
                    copyToastMessageRef.current = 'Code copied to clipboard';
                  }}
                  hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                >
                  <Ionicons name="copy-outline" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            )
          }}
        >
          {item.content}
        </Markdown>
              </View>
            )}
          </View>
          
          {/* Copy button */}
          <TouchableOpacity 
            style={styles.copyButton} 
            onPress={() => copyToClipboard(item.content)}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <Ionicons 
              name="copy-outline" 
              size={16} 
              color={currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.75)'} 
            />
          </TouchableOpacity>
      </View>
      {item.role === 'assistant' && item.stats && (
        <View style={styles.statsContainer}>
          <Text style={[styles.statsText, { color: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.75)' }]}>
              {`${item.stats.tokens.toLocaleString()} tokens · ${item.stats.duration.toFixed(1)}s`}
          </Text>
            
            {/* Add regenerate button below stats for the last assistant message */}
            {item === messages[messages.length - 1] && (
              <TouchableOpacity 
                style={[
                  styles.regenerateButtonRow,
                  isRegenerating && styles.regenerateButtonDisabled
                ]}
                onPress={() => {
                  handleRegenerate();
                }}
                disabled={isLoading || isRegenerating}
              >
                {isRegenerating ? (
                  <ActivityIndicator size="small" color={currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.75)'} />
                ) : (
                  <>
                    <Ionicons 
                      name="refresh-outline" 
                      size={14} 
                      color={currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.75)'} 
                    />
                    <Text style={[styles.regenerateButtonText, { color: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.75)' }]}>
                      Regenerate.
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
        </View>
      )}
    </View>
    );
  }, [themeColors, messages, isLoading, isRegenerating, handleRegenerate, copyToClipboard]);

  const startNewChat = async () => {
    const newChatId = Date.now().toString();
    
    try {
      // Save current chat if it has messages
      if (messages.length > 0) {
        const updatedHistories = [...chatHistories, {
          id: currentChatId,
          messages,
          timestamp: Date.now()
        }];
        
        // Update AsyncStorage first
        await AsyncStorage.setItem('chatHistories', JSON.stringify(updatedHistories));
        // Then update state
        setChatHistories(updatedHistories);
        
        // Clear current chat messages
        setMessages([]);
        await AsyncStorage.setItem('chatMessages', JSON.stringify([]));
      }
      
      setCurrentChatId(newChatId);
    } catch (error) {
      console.error('Error starting new chat:', error);
    }
  };

  const loadChatHistories = async () => {
    try {
      const savedHistories = await AsyncStorage.getItem('chatHistories');
      if (savedHistories) {
        const parsed = JSON.parse(savedHistories);
        if (Array.isArray(parsed)) {
          setChatHistories(parsed);
        } else {
          setChatHistories([]);
        }
      } else {
        setChatHistories([]);
      }
    } catch (error) {
      console.error('Error loading chat histories:', error);
      setChatHistories([]);
    }
  };

  const loadChat = async (chatId: string) => {
    const selectedChat = chatHistories.find(chat => chat.id === chatId);
    if (selectedChat) {
      // Save current chat if it has messages and is different from the one being loaded
      if (messages.length > 0 && currentChatId !== chatId) {
        const updatedHistories = chatHistories.map(chat => 
          chat.id === currentChatId 
            ? { id: currentChatId, messages, timestamp: Date.now() } 
            : chat
        );
        
        // Add current chat to history if it's not already there
        if (!updatedHistories.some(chat => chat.id === currentChatId)) {
          updatedHistories.push({ 
            id: currentChatId, 
            messages, 
            timestamp: Date.now() 
          });
        }
        
        setChatHistories(updatedHistories);
        await AsyncStorage.setItem('chatHistories', JSON.stringify(updatedHistories));
      }
      
      // Load the selected chat
      setCurrentChatId(chatId);
      setMessages(selectedChat.messages);
      await AsyncStorage.setItem('chatMessages', JSON.stringify(selectedChat.messages));
    }
  };

  const handleChatDeleted = (deletedChatId: string) => {
    if (currentChatId === deletedChatId) {
      setCurrentChatId(Date.now().toString());
      setMessages([]);
      saveMessages([]);
    }
    // Also update chat histories
    loadChatHistories();
  };

  const handleAllChatsDeleted = () => {
    setCurrentChatId(Date.now().toString());
    setMessages([]);
    saveMessages([]);
    setChatHistories([]);
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <AppHeader />
      
      {/* iOS Copy Toast */}
      {showCopyToast && (
        <View style={styles.copyToast}>
          <Text style={styles.copyToastText}>{copyToastMessageRef.current}</Text>
        </View>
      )}
      
      <View style={styles.headerButtons}>
        <TouchableOpacity
          style={[styles.headerButton, { backgroundColor: themeColors.headerBackground }]}
          onPress={startNewChat}
        >
          <Ionicons name="add-outline" size={22} color="#fff" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.headerButton, { backgroundColor: themeColors.headerBackground }]}
          onPress={() => navigation.navigate('ChatHistory', {
            onChatDeleted: handleChatDeleted,
            onAllChatsDeleted: handleAllChatsDeleted,
          })}
        >
          <Ionicons name="time-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.content}>
          <View style={styles.modelSelectorWrapper}>
            <ModelSelector 
              ref={modelSelectorRef}
              isOpen={shouldOpenModelSelector}
              onClose={() => setShouldOpenModelSelector(false)}
              preselectedModelPath={preselectedModelPath}
            />
          </View>

          <View style={styles.chatContainer}>
            {messages.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons 
                  name="chatbubble-ellipses-outline" 
                  size={48} 
                  color={currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.75)'} 
                />
                <Text style={[styles.emptyStateText, { color: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.75)' }]}>
                  Select a model and start chatting
                </Text>
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={[...messages].reverse()}
                renderItem={renderMessage}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.messageList}
                inverted={true}
                maintainVisibleContentPosition={{
                  minIndexForVisible: 0,
                }}
              />
            )}
          </View>

          <View
            style={[
              styles.inputContainer,
              { backgroundColor: themeColors.borderColor },
              isLoading && styles.inputContainerDisabled
            ]}
          >
            <TextInput
              style={[
                styles.input,
                { 
                  color: themeColors.text,
                  maxHeight: 100
                }
              ]}
              value={message}
              onChangeText={setMessage}
              placeholder={isLoading ? "Model is processing..." : "Type a message..."}
              placeholderTextColor={currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)'}
              multiline
              editable={!isLoading}
            />
            {isLoading ? (
              <View style={styles.loadingButtonsContainer}>
              <ActivityIndicator
                size="small"
                color={themeColors.headerBackground}
                  style={styles.loadingIndicator}
                />
                <TouchableOpacity
                  onPress={handleCancelGeneration}
                  style={[
                    styles.cancelButton,
                    { backgroundColor: '#d32f2f' }
                  ]}
                >
                  <Ionicons
                    name="close"
                    size={20}
                    color="#fff"
                  />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleSend}
                style={[
                  styles.sendButton,
                  {
                    backgroundColor: message.trim()
                      ? themeColors.headerBackground
                      : themeColors.borderColor,
                  },
                ]}
                disabled={!message.trim() || isLoading}
              >
                <Ionicons
                  name="send"
                  size={20}
                  color={message.trim() ? '#fff' : currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)'}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
    paddingTop: 20,
  },
  chatContainer: {
    flex: 1,
    marginTop: 8,
  },
  messageList: {
    flexGrow: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    width: '100%',
  },
  messageBubble: {
    maxWidth: '85%',
    paddingLeft: 12,
    paddingRight: 12,
    borderRadius: 16,
    marginVertical: 4,
    marginHorizontal: 16,
    position: 'relative',
    padding: 15,
  },
  messageBubbleContent: {
    paddingRight: 24, // Make room for the copy button
  },
  userMessage: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    borderRadius: 24,
    marginTop: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modelSelectorWrapper: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  inputContainerDisabled: {
    opacity: 0.7,
  },
  codeBlockContainer: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 12,
    marginVertical: 4,
    position: 'relative',
    color: '#fff',
  },
  codeText: {
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
  },
  copyButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
    borderRadius: 4,
    backgroundColor: 'transparent',
  },
  codeBlockCopyButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    padding: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  activeButton: {
    backgroundColor: '#4a0660',
  },
  statsContainer: {
    marginHorizontal: 16,
    marginTop: 4,
  },
  statsText: {
    fontSize: 12,
    opacity: 0.7,
  },
  thinkingBubble: {
    padding: 12,
    borderRadius: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    position: 'relative',
  },
  thinkingContent: {
    paddingRight: 24, // Make room for the copy button
  },
  thinkingText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  thinkingContentText: {
    fontSize: 14,
    lineHeight: 20,
  },
  headerButtons: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 16,
    right: 16,
    flexDirection: 'row',
    gap: 8,
    zIndex: 1,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  copyToast: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 60,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 1000,
  },
  copyToastText: {
    color: '#fff',
    fontSize: 14,
  },
  codeBlock: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 12,
    marginVertical: 4,
    position: 'relative',
  },
  regenerateButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    padding: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  regenerateButtonText: {
    fontSize: 12,
    marginLeft: 4,
  },
  regenerateButtonDisabled: {
    opacity: 0.5,
  },
  loadingButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingIndicator: {
    marginRight: 8,
  },
  cancelButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 