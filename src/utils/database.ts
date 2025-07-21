import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

let db: SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLiteDatabase> {
  if (!db) {
    db = await openDatabaseAsync('locations.db' );
  }
  return db;
}

export async function initDb(): Promise<void> {
  const database = await getDb();
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
}

/** Insere uma nova linha de localização */
export async function insertLocation(
  user_id: number,
  latitude: number,
  longitude: number,
  timestamp: string
): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    `INSERT INTO location_history
       (user_id, latitude, longitude, timestamp, sent)
     VALUES (?, ?, ?, ?, 0);`,
    user_id,
    latitude,
    longitude,
    timestamp
  );
}
