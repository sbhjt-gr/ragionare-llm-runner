import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import DownloadableModelItem, { DownloadableModel } from './DownloadableModelItem';
import { modelDownloader } from '../../services/ModelDownloader';
import { Dialog, Portal, PaperProvider, Text, Button } from 'react-native-paper';

interface DownloadableModelListProps {
  models: DownloadableModel[];
  storedModels: any[];
  downloadProgress: any;
  setDownloadProgress: React.Dispatch<React.SetStateAction<any>>;
}

const DownloadableModelList: React.FC<DownloadableModelListProps> = ({ 
  models,
  storedModels,
  downloadProgress, 
  setDownloadProgress
}) => {
  const navigation = useNavigation();
  const [initializingDownloads, setInitializingDownloads] = useState<{ [key: string]: boolean }>({});

  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogMessage, setDialogMessage] = useState('');

  const showDialog = (title: string, message: string) => {
    setDialogTitle(title);
    setDialogMessage(message);
    setDialogVisible(true);
  };

  const hideDialog = () => setDialogVisible(false);

  const isModelDownloaded = (modelName: string) => {
    return storedModels.some(storedModel => {
      const storedModelName = storedModel.name.split('.')[0];
      const downloadableModelName = modelName.split('.')[0];
      return storedModelName.toLowerCase() === downloadableModelName.toLowerCase();
    });
  };

  const handleDownload = async (model: DownloadableModel) => {
    if (isModelDownloaded(model.name)) {
      showDialog(
        'Model Already Downloaded',
        'This model is already in your stored models.'
      );
      return;
    }

    navigation.navigate('Downloads' as never);
    
    try {
      setInitializingDownloads(prev => ({ ...prev, [model.name]: true }));
      
      setDownloadProgress((prev: any) => ({
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
      
      setDownloadProgress((prev: any) => ({
        ...prev,
        [model.name]: {
          ...prev[model.name],
          downloadId
        }
      }));

      if (model.additionalFiles && model.additionalFiles.length > 0) {
        for (const additionalFile of model.additionalFiles) {
          try {
            await modelDownloader.downloadModel(
              additionalFile.url,
              additionalFile.name
            );
          } catch (error) {
            console.error(`Failed to download additional file ${additionalFile.name}:`, error);
          }
        }
      }

    } catch (error) {
      console.error('Download error:', error);
      setDownloadProgress((prev: any) => {
        const newProgress = { ...prev };
        delete newProgress[model.name];
        return newProgress;
      });
      showDialog('Error', 'Failed to start download');
    } finally {
      setInitializingDownloads(prev => ({ ...prev, [model.name]: false }));
    }
  };

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {models.map(model => (
        <DownloadableModelItem
          key={model.name}
          model={model}
          isDownloaded={isModelDownloaded(model.name)}
          isDownloading={Boolean(downloadProgress[model.name])}
          isInitializing={Boolean(initializingDownloads[model.name])}
          downloadProgress={downloadProgress[model.name]}
          onDownload={handleDownload}
        />
      ))}

      {/* Dialog Portal */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={hideDialog}>
          <Dialog.Title>{dialogTitle}</Dialog.Title>
          <Dialog.Content>
            <Text>{dialogMessage}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={hideDialog}>OK</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingTop: 0,
  },
});

export default DownloadableModelList; 