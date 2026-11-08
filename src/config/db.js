import pg from 'pg';
import { attachDatabasePool } from '@vercel/functions';
import { env } from './env.js';

pg.types.setTypeParser(1082, (value) => value);

const { Pool } = pg;

export const pool = new Pool({
    connectionString: env.databaseUrl,
    ssl: env.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
    ...(process.env.VERCEL ? { max: 2, idleTimeoutMillis: 10000 } : {}),
});

if (process.env.VERCEL) attachDatabasePool(pool);

pool.on('error', (err) => {
    console.error('Unexpected DB error', err);
  if (!process.env.VERCEL) process.exit(1);
});

export const query = (text, params) => pool.query(text, params);
