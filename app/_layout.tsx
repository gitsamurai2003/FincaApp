import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { LicenseGuard } from '../components/LicenseGuard';
import { inicializarBaseDeDatos } from '../db/init';

export {
  ErrorBoundary
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  const [dbLoaded, setDbLoaded] = useState(false);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    async function prepararEntorno() {
      try {
        await inicializarBaseDeDatos();
        console.log("DB: Base de datos cargada correctamente en el Layout.");
      } catch (e) {
        console.error("DB_ERROR: Falla crítica al inicializar las tablas:", e);
      } finally {
        setDbLoaded(true);
      }
    }

    prepararEntorno();
  }, []);

  useEffect(() => {
    if (fontsLoaded && dbLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, dbLoaded]);

  if (!fontsLoaded || !dbLoaded) {
    return null;
  }

  // Transformación final: Envuelve la navegación inicializada en el escudo
  return (
    <LicenseGuard>
      <RootLayoutNav />
    </LicenseGuard>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="crear-finca" options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="inventario" options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="produccion" options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="crear-animal" options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}