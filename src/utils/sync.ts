// src/utils/sync.ts
import { getDb } from './database';
import { API_BASE_URL } from '@env';

export async function syncPendingLocations(): Promise<void> {
  try {
    const db = await getDb();

    // pega todas as linhas pendentes como um array de objetos
    const rows = await db.getAllAsync<{
      id: number;
      user_id: number;
      latitude: number;
      longitude: number;
      timestamp: string;
      sent: number;
    }>('SELECT * FROM location_history WHERE sent = 0;');

    for (const loc of rows) {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/location-histories`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: loc.user_id,
              latitude: loc.latitude,
              longitude: loc.longitude,
              timestamp: loc.timestamp,
            }),
          }
        );

        if (response.ok) {
          // marca como enviado
          await db.runAsync(
            'UPDATE location_history SET sent = 1 WHERE id = ?;',
            loc.id
          );
        }
      } catch (err) {
        console.error('Erro ao sincronizar item:', err);
      }
    }
  } catch (err) {
    console.error('Erro ao buscar registros pendentes:', err);
  }
}
