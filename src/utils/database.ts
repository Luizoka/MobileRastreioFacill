import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

let db: SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLiteDatabase> {
  if (!db) {
    console.log('📂 Abrindo banco de dados "locations.db"...');
    db = await openDatabaseAsync('locations.db');
    console.log('✅ Banco de dados aberto com sucesso.');
  }
  return db;
}

let isInitialized = false;

export async function initDb(): Promise<void> {
  if (isInitialized) {
    console.log('⚠️ initDb já foi executado. Ignorando...');
    return;
  }

  try {
    const database = await getDb();
    console.log('⚙️ Iniciando configuração do banco de dados...');

    await database.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS location_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        timestamp TEXT NOT NULL,
        sent INTEGER DEFAULT 0
      );
    `);

    console.log('✅ Tabela "location_history" criada (ou já existia).');
    isInitialized = true;
  } catch (error) {
    console.error('❌ Erro ao inicializar o banco de dados:', error);
  }
}

export async function insertLocation(
  user_id: number,
  latitude: number,
  longitude: number,
  timestamp: string
): Promise<void> {
  if (!db) {
    console.warn('⚠️ Banco ainda não está inicializado, abortando insert.');
    return;
  }

  try {
    await db.runAsync(
      `INSERT INTO location_history
         (user_id, latitude, longitude, timestamp, sent)
       VALUES (?, ?, ?, ?, 0);`,
      user_id,
      latitude,
      longitude,
      timestamp
    );
    console.log(`📍 Localização inserida localmente (user_id=${user_id})`);
  } catch (error) {
    console.error('❌ Erro ao inserir localização:', error);
  }
}
