import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { configuracionApp } from '../db/schema';

export enum LicenseState {
  FIRST_LAUNCH = 'FIRST_LAUNCH',
  TRIAL_ACTIVE = 'TRIAL_ACTIVE',
  TRIAL_EXPIRED = 'TRIAL_EXPIRED',
  UNLOCKED_PERMANENT = 'UNLOCKED_PERMANENT',
}

const TRIAL_DAYS = 10;
const SECRET_SALT = 8345;

export const LicenseManager = {
  generateCodeForToday(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateInt = parseInt(`${year}${month}${day}`, 10);

    const product = dateInt * SECRET_SALT;
    const scrambled = String(product).split('').reverse().join('');
    const rawCode = scrambled.slice(0, 6);
    
    return rawCode.padStart(6, '0');
  },

  async checkLicenseStatus(): Promise<LicenseState> {
    try {
      const config = await db.select().from(configuracionApp).where(eq(configuracionApp.id, 1)).get();
      
      if (!config) {
        return LicenseState.FIRST_LAUNCH;
      }

      if (config.estadoLicencia === LicenseState.UNLOCKED_PERMANENT) {
        return LicenseState.UNLOCKED_PERMANENT;
      }

      if (config.estadoLicencia === LicenseState.TRIAL_ACTIVE) {
        const now = Date.now();
        const diffTime = Math.abs(now - config.fechaInicioPrueba);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays >= TRIAL_DAYS) {
          await db.update(configuracionApp)
            .set({ estadoLicencia: LicenseState.TRIAL_EXPIRED })
            .where(eq(configuracionApp.id, 1));
          return LicenseState.TRIAL_EXPIRED;
        }
        return LicenseState.TRIAL_ACTIVE;
      }

      return config.estadoLicencia as LicenseState;
    } catch (error) {
      console.error(error);
      return LicenseState.FIRST_LAUNCH;
    }
  },

  async startTrial(): Promise<void> {
    try {
      const config = await db.select().from(configuracionApp).where(eq(configuracionApp.id, 1)).get();
      
      if (!config) {
        await db.insert(configuracionApp).values({
          id: 1,
          estadoLicencia: LicenseState.TRIAL_ACTIVE,
          fechaInicioPrueba: Date.now(),
        });
      } else {
        await db.update(configuracionApp)
          .set({
            estadoLicencia: LicenseState.TRIAL_ACTIVE,
            fechaInicioPrueba: Date.now(),
          })
          .where(eq(configuracionApp.id, 1));
      }
    } catch (error) {
      console.error(error);
    }
  },

  async unlockPermanently(inputCode: string): Promise<boolean> {
    const expectedCode = this.generateCodeForToday();
    
    if (inputCode.trim() === expectedCode) {
      try {
        const config = await db.select().from(configuracionApp).where(eq(configuracionApp.id, 1)).get();
        
        if (config) {
          await db.update(configuracionApp)
            .set({ estadoLicencia: LicenseState.UNLOCKED_PERMANENT })
            .where(eq(configuracionApp.id, 1));
        } else {
          await db.insert(configuracionApp).values({
            id: 1,
            estadoLicencia: LicenseState.UNLOCKED_PERMANENT,
            fechaInicioPrueba: Date.now(),
          });
        }
        return true;
      } catch (error) {
        console.error(error);
        return false;
      }
    }
    return false;
  }
};