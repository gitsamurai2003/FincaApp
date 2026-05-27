import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LicenseManager, LicenseState } from '../utils/LicenseManager';

interface LicenseGuardProps {
  children: React.ReactNode;
}

export const LicenseGuard: React.FC<LicenseGuardProps> = ({ children }) => {
  const [appState, setAppState] = useState<LicenseState | null>(null);
  const [viewMode, setViewMode] = useState<'INITIAL' | 'INPUT_CODE'>('INITIAL');
  const [inputCode, setInputCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const CONTACT_EMAIL = 'dreamviewvr@gmail.com'; 

  useEffect(() => {
    checkInitialState();
  }, []);

  const checkInitialState = async () => {
    // ⚠️ AGREGA ESTA LÍNEA TEMPORALMENTE PARA BORRAR LA MEMORIA:
  await require('@react-native-async-storage/async-storage').default.clear();
    const currentState = await LicenseManager.checkLicenseStatus();
    setAppState(currentState);
  };

  const handleStartTrial = async () => {
    await LicenseManager.startTrial();
    setAppState(LicenseState.TRIAL_ACTIVE);
  };

  const handleUnlock = async () => {
    setErrorMsg('');
    const isUnlocked = await LicenseManager.unlockPermanently(inputCode);
    
    if (isUnlocked) {
      setAppState(LicenseState.UNLOCKED_PERMANENT);
    } else {
      setErrorMsg('Código incorrecto o vencido. Verifica la fecha del dispositivo.');
    }
  };

  // 1. Pantalla de carga mientras se lee AsyncStorage
  if (appState === null) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  // 2. Si tiene licencia permanente o el trial está activo, mostramos la app real
  if (appState === LicenseState.UNLOCKED_PERMANENT || appState === LicenseState.TRIAL_ACTIVE) {
    return <>{children}</>;
  }

  // 3. Si no, mostramos la pantalla de bloqueo
  return (
    <View style={styles.overlayContainer}>
      <View style={styles.card}>
        <Text style={styles.title}>FincaApp Bloqueada</Text>
        
        <Text style={styles.description}>
          {appState === LicenseState.TRIAL_EXPIRED 
            ? 'Tu periodo de prueba de 10 días ha finalizado.'
            : 'Estás utilizando una versión de prueba.'}
        </Text>
        
        <Text style={styles.contactText}>
          Para desbloqueo permanente, comunícate a:{'\n'}
          <Text style={styles.emailText}>{CONTACT_EMAIL}</Text>
        </Text>

        {/* MODO INICIAL: Botones de opciones */}
        {viewMode === 'INITIAL' && (
          <View style={styles.buttonContainer}>
            {/* Solo mostramos el botón de Trial si es la primera vez */}
            {appState === LicenseState.FIRST_LAUNCH && (
              <TouchableOpacity style={styles.buttonTrial} onPress={handleStartTrial}>
                <Text style={styles.buttonText}>Desbloquear 10 días</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={styles.buttonCode} 
              onPress={() => setViewMode('INPUT_CODE')}
            >
              <Text style={styles.buttonTextOutline}>Ingresar código permanente</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* MODO INPUT: Formulario para ingresar el código */}
        {viewMode === 'INPUT_CODE' && (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Ingresa el código de 6 dígitos"
              keyboardType="number-pad"
              maxLength={6}
              value={inputCode}
              onChangeText={setInputCode}
            />
            {errorMsg !== '' && <Text style={styles.errorText}>{errorMsg}</Text>}
            
            <TouchableOpacity style={styles.buttonSubmit} onPress={handleUnlock}>
              <Text style={styles.buttonText}>Desbloquear</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.buttonCancel} 
              onPress={() => {
                setViewMode('INITIAL');
                setErrorMsg('');
              }}
            >
              <Text style={styles.buttonTextOutline}>Volver</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  overlayContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000EE', // Fondo oscuro translúcido
    padding: 20,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 25,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 15,
  },
  contactText: {
    fontSize: 14,
    textAlign: 'center',
    color: '#444',
    marginBottom: 25,
  },
  emailText: {
    fontWeight: 'bold',
    color: '#2E7D32', // Verde Finca
  },
  buttonContainer: {
    width: '100%',
    gap: 15, // Si usas una versión antigua de React Native, cambia esto por margins en los botones
  },
  buttonTrial: {
    backgroundColor: '#2E7D32',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonCode: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#2E7D32',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  inputContainer: {
    width: '100%',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    padding: 15,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 10,
    backgroundColor: '#FAFAFA',
  },
  buttonSubmit: {
    backgroundColor: '#1976D2',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonCancel: {
    backgroundColor: 'transparent',
    padding: 15,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonTextOutline: {
    color: '#2E7D32',
    fontWeight: 'bold',
    fontSize: 16,
  },
  errorText: {
    color: '#D32F2F',
    textAlign: 'center',
    marginBottom: 10,
    fontSize: 14,
  }
});