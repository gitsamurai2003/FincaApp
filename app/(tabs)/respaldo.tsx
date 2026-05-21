import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { AlertTriangle, ArrowLeft, Download, Upload } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const DB_NAME = 'finca.db'; 

export default function RespaldoScreen() {
  const router = useRouter();
  const [procesando, setProcesando] = useState(false);

  const crearCopiaSeguridad = async () => {
    try {
      setProcesando(true);
      const dbUri = `${(FileSystem as any).documentDirectory}SQLite/${DB_NAME}`;
      
      const info = await FileSystem.getInfoAsync(dbUri);
      if (!info.exists) {
        Alert.alert('Sin Datos', 'No se encontró un archivo de base de datos local válido para respaldar.');
        return;
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(dbUri, {
          dialogTitle: 'Guardar copia de seguridad de la Finca',
          mimeType: 'application/x-sqlite3',
          UTI: 'public.database'
        });
      } else {
        Alert.alert('Error', 'La función de compartir archivos no está disponible en este dispositivo.');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Fallo al procesar y empaquetar la base de datos.');
    } finally {
      setProcesando(false);
    }
  };

const [debugMode, setDebugMode] = useState(false);

const borrarBaseDeDatos = async () => {
  try {
    const dbUri = `${FileSystem.documentDirectory}SQLite/${DB_NAME}`;
    
    const info = await FileSystem.getInfoAsync(dbUri);
    
    if (!info.exists) {
      Alert.alert('Info', 'La base de datos no existe en este dispositivo.');
      return;
    }
    
    Alert.alert(
      '⚠️ ¿Eliminar base de datos?',
      `Se borrará permanentemente: ${DB_NAME}\n\nEsta acción NO se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await FileSystem.deleteAsync(dbUri, { idempotent: true });
              Alert.alert(
                'Eliminado',
                'La base de datos ha sido borrada.\n\nReinicia la app para que se cree una nueva vacía.',
                [{ text: 'Entendido' }]
              );
            } catch (error) {
              console.error('Error borrando BD:', error);
              Alert.alert('Error', 'No se pudo eliminar el archivo.');
            }
          },
        },
      ]
    );
  } catch (error) {
    console.error('Error verificando BD:', error);
    Alert.alert('Error', 'No se pudo verificar el estado de la base de datos.');
  }
};
  const restaurarCopiaSeguridad = async () => {
    Alert.alert(
      '¿Restaurar Base de Datos?',
      'Esta acción reemplazará de forma irreversible todos los animales, fincas y pesajes actuales por los del archivo seleccionado. La aplicación se cerrará para aplicar los cambios.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, Restaurar',
          style: 'destructive',
          onPress: async () => {
            try {
              setProcesando(true);
              const resultado = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
              });

              if (resultado.canceled || !resultado.assets || resultado.assets.length === 0) {
                setProcesando(false);
                return;
              }

              const archivoSeleccionado = resultado.assets[0];
              const destinoDbUri = `${(FileSystem as any).documentDirectory}SQLite/${DB_NAME}`;

              const carpetaSqlite = `${(FileSystem as any).documentDirectory}SQLite`;
              const infoCarpeta = await FileSystem.getInfoAsync(carpetaSqlite);
              if (!infoCarpeta.exists) {
                await FileSystem.makeDirectoryAsync(carpetaSqlite, { intermediates: true });
              }

              await FileSystem.copyAsync({
                from: archivoSeleccionado.uri,
                to: destinoDbUri,
              });

              Alert.alert(
                'Restauración Exitosa',
                'Los datos han sido sobrescritos de forma correcta. Por seguridad, reinicia la aplicación manualmente para inicializar el nuevo esquema de datos.',
                [{ text: 'Entendido' }]
              );

            } catch (error) {
              console.error(error);
              Alert.alert('Error de Restauración', 'El archivo provisto no pudo ser inyectado en el almacenamiento local SQLite.');
            } finally {
              setProcesando(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="#1e293b" size={24} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Copias de Seguridad</Text>
          <Text style={styles.headerSubtitle}>Mantenimiento de Datos SQLite</Text>
        </View>
        <View style={{width: 40}}/>
      </View>

      {procesando ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#065f46" />
          <Text style={styles.loadingText}>Procesando base de datos...</Text>
        </View>
      ) : (
        <View style={styles.content}>

          <TouchableOpacity style={styles.actionButton} onPress={crearCopiaSeguridad}>
            <View style={[styles.iconBox, { backgroundColor: '#d1fae5' }]}>
              <Download color="#065f46" size={24} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.btnTitle}>Crear Archivo de Respaldo</Text>
              <Text style={styles.btnDescription}>Exporta y comparte la base de datos con todas tus fincas y producciones actuales.</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, { marginTop: 16 }]} onPress={restaurarCopiaSeguridad}>
            <View style={[styles.iconBox, { backgroundColor: '#fee2e2' }]}>
              <Upload color="#991b1b" size={24} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.btnTitle}>Restaurar Base de Datos</Text>
              <Text style={styles.btnDescription}>Importa un archivo de respaldo previo. Sobrescribirá todos tus registros locales.</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.warningCard}>
            <AlertTriangle color="#b45309" size={24} style={{ marginRight: 12 }} />
            <Text style={styles.warningText}>
              Estas herramientas interactúan directamente con los archivos del sistema físico. Asegúrate de guardar tus respaldos en lugares seguros. Se recomienda enviar copias de la base de datos a servicios como Whatsapp, Gmail, Telegram, Drive, de esa manera la informacion queda respaldada en la nube y no se pierde aunque el dispositivo falle o se pierda.
            </Text>
          </View>
        </View>
      )}
{__DEV__ && debugMode && (
  <TouchableOpacity 
    style={[styles.actionButton, { marginTop: 16, borderColor: '#ef4444' }]} 
    onPress={borrarBaseDeDatos}
  >
    <View style={[styles.iconBox, { backgroundColor: '#fee2e2' }]}>
      <Upload color="#991b1b" size={24} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[styles.btnTitle, { color: '#991b1b' }]}>🗑️ Eliminar BD (Testing)</Text>
      <Text style={styles.btnDescription}>Borra finca.db para probar restauración desde respaldo.</Text>
    </View>
  </TouchableOpacity>
)}

{/* Toggle para mostrar/ocultar herramientas de debug */}
{__DEV__ && (
  <TouchableOpacity 
    onPress={() => setDebugMode(!debugMode)}
    style={{ marginTop: 16, alignSelf: 'center', padding: 8 }}
  >
    <Text style={{ fontSize: 10, color: '#64748b' }}>
      {debugMode ? 'Ocultar herramientas de debug' : 'Mostrar herramientas de debug'}
    </Text>
  </TouchableOpacity>
)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 60, paddingBottom: 16, paddingHorizontal: 16,
    backgroundColor: '#ffffff', borderBottomWidth: 1, borderColor: '#e2e8f0',
  },
  backButton: { padding: 8, borderRadius: 12, backgroundColor: '#f1f5f9' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  headerSubtitle: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  content: { padding: 24 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadingText: { marginTop: 16, fontSize: 14, color: '#475569', fontWeight: '500' },
  warningCard: {
    flexDirection: 'row', backgroundColor: '#fef3c7', padding: 16,
    borderRadius: 20, marginBottom: 24, marginTop: 16,
   borderWidth: 1, borderColor: '#fde68a',
    alignItems: 'center'
  },
  warningText: { flex: 1, fontSize: 12, color: '#92400e', lineHeight: 18, fontWeight: '500' },
  actionButton: {
    backgroundColor: '#ffffff', padding: 20, borderRadius: 24,
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1
  },
  iconBox: { padding: 12, borderRadius: 16, marginRight: 16 },
  btnTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  btnDescription: { fontSize: 12, color: '#64748b', marginTop: 4, lineHeight: 16 }
});