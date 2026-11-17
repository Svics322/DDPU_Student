import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Шукаємо .env як у папці src, так і в корені проєкту
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const isServerless = Boolean(process.env.VERCEL);
const dialect = process.env.DB_DIALECT || (isServerless ? 'sqlite' : 'postgres');

const common = {
  logging: false,
  define: {
    timestamps: false,
    freezeTableName: true
  }
};

export const sequelize =
  dialect === 'sqlite'
    ? new Sequelize({
        dialect: 'sqlite',
        // Єдина тека, доступна для запису у serverless-функції
        storage: process.env.DB_STORAGE || (isServerless ? '/tmp/app.db' : 'app.db'),
        ...common
      })
    : new Sequelize(
        process.env.DB_NAME || 'education_control',
        process.env.DB_USER || 'postgres',
        String(process.env.DB_PASSWORD ?? 'root'),
        {
          host: process.env.DB_HOST || 'localhost',
          port: Number(process.env.DB_PORT) || 5432,
          dialect: 'postgres',
          ...common
        }
      );
