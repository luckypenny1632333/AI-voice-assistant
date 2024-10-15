import dotenv from 'dotenv';
import { DataSource } from 'typeorm';

import { KeyValueStore } from './entities/key-value-store.entity';

dotenv.config(); // Load environment variables from .env

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || '5432'),
  username: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  entities: [KeyValueStore],
  synchronize: true, // Disable in production
  logging: true,
});
