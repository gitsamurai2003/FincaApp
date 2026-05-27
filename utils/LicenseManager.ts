import AsyncStorage from '@react-native-async-storage/async-storage';

// @ts-ignore - Fallback para entornos donde el tipado no se reconoce inmediatamente
const storage = AsyncStorage;

// Constantes de almacenamiento
const STORAGE_KEYS = {
  LICENSE_STATE: '@APP_LICENSE_STATE',
  TRIAL_START: '@TRIAL_START_DATE',
};

// Estados posibles
export enum LicenseState {
  FIRST_LAUNCH = 'FIRST_LAUNCH',
  TRIAL_ACTIVE = 'TRIAL_ACTIVE',
  TRIAL_EXPIRED = 'TRIAL_EXPIRED',
  UNLOCKED_PERMANENT = 'UNLOCKED_PERMANENT',
}

// Configuración del Trial y Seguridad
const TRIAL_DAYS = 10;
const SECRET_SALT = 8345; // Tu número secreto para el algoritmo

export const LicenseManager = {
  /**
   * Genera el código esperado para el día actual.
   * NUEVO ALGORITMO: Sin usar módulo (%). Multiplica, invierte y corta la cadena.
   */
  generateCodeForToday(): string {
    const today = new Date();
    // Formato YYYYMMDD (Ej: 20260526)
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateInt = parseInt(`${year}${month}${day}`, 10);

    // 1. Multiplicamos la fecha por el patrón secreto
    const product = dateInt * SECRET_SALT; // Ej hoy: 169074089470
    
    // 2. Volteamos el número al revés como texto para ofuscarlo (Scramble)
    const scrambled = String(product).split('').reverse().join(''); // Ej hoy: "074980470961"
    
    // 3. Tomamos los primeros 6 caracteres resultantes sin usar operaciones matemáticas
    const rawCode = scrambled.slice(0, 6);
    
    // Aseguramos que siempre devuelva 6 caracteres por seguridad
    return rawCode.padStart(6, '0');
  },

  /**
   * Evalúa el estado actual de la licencia al abrir la app.
   */
  async checkLicenseStatus(): Promise<LicenseState> {
    try {
      const currentState = await storage.getItem(STORAGE_KEYS.LICENSE_STATE);
      
      if (!currentState) {
        return LicenseState.FIRST_LAUNCH;
      }

      if (currentState === LicenseState.UNLOCKED_PERMANENT) {
        return LicenseState.UNLOCKED_PERMANENT;
      }

      if (currentState === LicenseState.TRIAL_ACTIVE) {
        const startDateStr = await storage.getItem(STORAGE_KEYS.TRIAL_START);
        if (startDateStr) {
          const startDate = parseInt(startDateStr, 10);
          const now = Date.now();
          const diffTime = Math.abs(now - startDate);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays > TRIAL_DAYS) {
            // El trial venció, actualizamos el estado
            await storage.setItem(STORAGE_KEYS.LICENSE_STATE, LicenseState.TRIAL_EXPIRED);
            return LicenseState.TRIAL_EXPIRED;
          }
          return LicenseState.TRIAL_ACTIVE;
        }
      }

      return currentState as LicenseState;
    } catch (error) {
      console.error('Error verificando licencia:', error);
      return LicenseState.FIRST_LAUNCH; // Fallback seguro
    }
  },

  /**
   * Inicia el periodo de prueba de 10 días.
   */
  async startTrial(): Promise<void> {
    try {
      await storage.setItem(STORAGE_KEYS.LICENSE_STATE, LicenseState.TRIAL_ACTIVE);
      await storage.setItem(STORAGE_KEYS.TRIAL_START, Date.now().toString());
    } catch (error) {
      console.error('Error iniciando trial:', error);
    }
  },

  /**
   * Valida el código ingresado por el usuario.
   */
  async unlockPermanently(inputCode: string): Promise<boolean> {
    const expectedCode = this.generateCodeForToday();
    
    if (inputCode.trim() === expectedCode) {
      try {
        await storage.setItem(STORAGE_KEYS.LICENSE_STATE, LicenseState.UNLOCKED_PERMANENT);
        return true;
      } catch (error) {
        console.error('Error guardando desbloqueo:', error);
        return false;
      }
    }
    return false;
  }
};