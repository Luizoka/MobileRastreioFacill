import { getDb } from './database';
import { API_BASE_URL } from '@env';

export async function syncPendingLocations(): Promise<void> {
  console.log('🔄 Iniciando sincronização de localizações pendentes...');
  
  try {
    const db = await getDb();

    const rows = await db.getAllAsync<{
      id: number;
      user_id: number;
      latitude: number;
      longitude: number;
      timestamp: string;
      sent: number;
    }>('SELECT * FROM location_history WHERE sent = 0;');

    console.log(`📦 ${rows.length} localização(ões) pendente(s) encontrada(s) no banco local.`);

    for (const loc of rows) {
      console.log(`📍 Sincronizando: ID=${loc.id}, user_id=${loc.user_id}, lat=${loc.latitude}, lng=${loc.longitude}, timestamp=${loc.timestamp}`);
      
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
          console.log(`✅ Localização ID ${loc.id} sincronizada com sucesso!`);
          await db.runAsync(
            'UPDATE location_history SET sent = 1 WHERE id = ?;',
            loc.id
          );
        } else {
          const errorText = await response.text();
          console.error(`❌ Falha ao sincronizar localização ID ${loc.id}. Status: ${response.status} - ${errorText}`);
        }
      } catch (err) {
        console.error(`❌ Erro na requisição para ID ${loc.id}:`, err);
      }
    }

    console.log('✅ Finalizou tentativa de sincronização de todas as localizações pendentes.');
  } catch (err) {
    console.error('❌ Erro ao buscar registros pendentes do banco local:', err);
  }
}
