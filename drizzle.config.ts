// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './db/schema.ts',
  out: './drizzle', 
  // 👇 AGREGA ESTO para que Drizzle entienda el entorno local de Expo
  dbCredentials: {
    url: 'finca.db',
  }
});