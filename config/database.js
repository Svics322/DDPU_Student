import { Sequelize } from 'sequelize';
import pg from 'pg';
import pgHstore from 'pg-hstore';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Шукаємо .env як у папці src, так і в корені проєкту
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const isServerless = Boolean(process.env.VERCEL);
// На хостингу типово Postgres: файлова система там лише для читання, а /tmp зникає
// разом з інстансом. SQLite лишається для локальної роботи або явного DB_DIALECT.
const dialect = process.env.DB_DIALECT || (isServerless ? 'postgres' : 'sqlite');

const common = {
  logging: false,
  // Sequelize підключає драйвер динамічно (require('pg')), і бандлер хостингу його
  // не бачить. Явний імпорт + dialectModule гарантує, що пакет потрапить у функцію.
  dialectModule: pg,
  define: {
    timestamps: false,
    freezeTableName: true
  }
};

// pg-hstore так само підтягується динамічно — тримаємо посилання, щоб його не вирізало
void pgHstore;

export const sequelize = process.env.DATABASE_URL
  ? // Neon (і більшість хостингів) віддають один рядок підключення.
    new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      dialectOptions:
        process.env.DB_SSL === 'false'
          ? {}
          : { ssl: { require: true, rejectUnauthorized: false } },
      ...common
    })
  : dialect === 'sqlite'
    ? new Sequelize({
        dialect: 'sqlite',
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
          // Хмарні Postgres (Neon, Supabase, Render) вимагають SSL.
          // Локальний Postgres зазвичай без нього — вимкнути через DB_SSL=false.
          dialectOptions:
            process.env.DB_SSL === 'false'
              ? {}
              : { ssl: { require: true, rejectUnauthorized: false } },
          ...common
        }
      );
