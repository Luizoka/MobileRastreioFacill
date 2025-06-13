import * as SQLite from 'expo-sqlite';

// Banco assíncrono — deve ser aberto antes de qualquer operação
let db: SQLite.SQLiteDatabase | null = null;

export const initDatabase = async (): Promise<void> => {
  db = await SQLite.openDatabaseAsync('localizacoes.db');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS localizacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      latitude REAL,
      longitude REAL,
      timestamp TEXT,
      company_ids TEXT,
      enviado INTEGER DEFAULT 0
    );
  `);
  console.log('🛠️ Banco de dados inicializado e tabela criada (se necessário).');
};

export interface Localizacao {
  id?: number;
  latitude: number;
  longitude: number;
  timestamp: string;
  company_ids: number[];
  enviado: number;
}

export const inserirLocalizacao = async (
  latitude: number,
  longitude: number,
  timestamp: string,
  companyIds: number[]
): Promise<void> => {
  if (!db) db = await SQLite.openDatabaseAsync('localizacoes.db');
  const companyIdsJson = JSON.stringify(companyIds);

  try {
    await db.runAsync(
      `INSERT INTO localizacoes (latitude, longitude, timestamp, company_ids, enviado)
       VALUES (?, ?, ?, ?, 0);`,
      [latitude, longitude, timestamp, companyIdsJson]
    );
    console.log('✅ Localização salva no SQLite:', {
      latitude,
      longitude,
      timestamp,
      companyIds
    });
  } catch (error) {
    console.error('❌ Erro ao salvar localização no SQLite:', error);
  }
};

export const buscarPendentes = async (): Promise<Localizacao[]> => {
  if (!db) db = await SQLite.openDatabaseAsync('localizacoes.db');

  try {
    const result = await db.getAllAsync<{
      id: number;
      latitude: number;
      longitude: number;
      timestamp: string;
      company_ids: string;
      enviado: number;
    }>('SELECT * FROM localizacoes WHERE enviado = 0;');

    const parsed = result.map((row) => ({
      ...row,
      company_ids: JSON.parse(row.company_ids),
    }));

    console.log(`📦 ${parsed.length} localizações pendentes encontradas no SQLite.`);
    return parsed;
  } catch (error) {
    console.error('❌ Erro ao buscar localizações pendentes:', error);
    return [];
  }
};

export const marcarComoEnviado = async (id: number): Promise<void> => {
  if (!db) db = await SQLite.openDatabaseAsync('localizacoes.db');

  try {
    await db.runAsync('UPDATE localizacoes SET enviado = 1 WHERE id = ?;', [id]);
    console.log(`✅ Localização marcada como enviada (ID: ${id})`);
  } catch (error) {
    console.error(`❌ Erro ao marcar localização como enviada (ID: ${id}):`, error);
  }
};
