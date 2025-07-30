import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { getValidToken } from '../utils/auth';
import { API_BASE_URL } from '@env';
import { insertLocation } from '../utils/database';

export const LOCATION_TASK_NAME = 'background-location-task';
export let isBackgroundTrackingActive = false;

export const checkBackgroundLocationAvailable = async (): Promise<boolean> => {
  try {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      return false;
    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    return backgroundStatus === 'granted';
  } catch (error) {
    console.error('Erro ao verificar permissões de localização:', error);
    return false;
  }
};

export const startBackgroundUpdate = async (): Promise<boolean> => {
  try {
    const hasPermissions = await checkBackgroundLocationAvailable();
    if (!hasPermissions) {
      console.warn('Permissões de localização em segundo plano não concedidas');
      return false;
    }

    const provider = await Location.getProviderStatusAsync();
    const accuracy = provider.gpsAvailable
      ? Location.Accuracy.Highest
      : provider.networkAvailable
      ? Location.Accuracy.High
      : null;

    if (!accuracy) {
      console.warn('❌ Sem GPS ou rede disponível para localização.');
      return false;
    }

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy,
      timeInterval: 60000,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Rastreio Fácil',
        notificationBody: 'Rastreamento em segundo plano ativo',
        notificationColor: '#1a73e8',
      },
      pausesUpdatesAutomatically: true,
      activityType: Location.ActivityType.AutomotiveNavigation,
    });

    isBackgroundTrackingActive = true;
    return true;
  } catch (error) {
    console.error('Erro ao iniciar rastreamento em segundo plano:', error);
    return false;
  }
};

export const stopBackgroundUpdate = async (): Promise<boolean> => {
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    if (registered) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      isBackgroundTrackingActive = false;
      return true;
    }
    return false;
  } catch (error) {
    console.error('Erro ao parar rastreamento em segundo plano:', error);
    return false;
  }
};

export const sendLocationToApi = async (
  latitude: number | string,
  longitude: number | string,
  companyIds: number[]
): Promise<{ success: boolean; error?: string; status?: number }> => {
  const token = await getValidToken();
  if (!token) {
    console.error("❌ Token não encontrado");
    return { success: false, error: 'Token não encontrado', status: 401 };
  }

  // Decodifica o token para extrair o user_id
  try {
    const [, payloadBase64] = token.split('.');
    const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
    const payloadJson = atob(base64);
    const payload = JSON.parse(payloadJson);
    const userId = payload?.id;

    if (!userId) {
      console.error("❌ ID do usuário não encontrado no token");
      return { success: false, error: 'ID do usuário não encontrado no token', status: 400 };
    }

    const body = {
      user_id: userId,
      latitude: typeof latitude === 'string' ? parseFloat(latitude) : latitude,
      longitude: typeof longitude === 'string' ? parseFloat(longitude) : longitude,
      company_ids: companyIds,
    };

    console.log("📤 Enviando localização para a API:", JSON.stringify(body));

    const res = await fetch(`${API_BASE_URL}/api/location-histories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    console.log(`📡 Status da resposta: ${res.status}`);
    console.log("📥 Resposta bruta da API:", text);

    let data;
    try {
      data = JSON.parse(text);
    } catch (parseErr) {
      console.error("❌ Erro ao fazer parse da resposta JSON:", parseErr);
      return { success: false, error: text, status: res.status };
    }

    if (res.status === 201) {
      console.log("✅ Localização enviada com sucesso");
      return { success: true, status: res.status };
    } else {
      console.warn("⚠️ Localização não enviada:", data?.error || 'Erro desconhecido');
      return { success: false, error: data?.error || 'Erro desconhecido', status: res.status };
    }
  } catch (error: any) {
    console.error("❌ Erro no sendLocationToApi:", error);
    return { success: false, error: error.message, status: 500 };
  }
};

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  console.log(`🛰️ Tarefa ${LOCATION_TASK_NAME} acionada`);

  if (error) {
    console.error('Erro na task de localização:', error);
    return;
  }

  const locations = (data as any).locations as Location.LocationObject[];
  if (!locations || locations.length === 0) {
    console.warn('Nenhuma localização disponível na task');
    return;
  }

  const { latitude, longitude } = locations[0].coords;
  const timestamp = new Date().toISOString();

  try {
    const token = await getValidToken();
    if (token) {
      const [, payloadB64] = token.split('.');
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
      await insertLocation(payload.id, latitude, longitude, timestamp);
    }

    if (token) {
      const userRes = await fetch(
        `${API_BASE_URL}/api/user-role-companies/user/${JSON.parse(atob(token.split('.')[1])).id}/role?role=employee`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (userRes.ok) {
        const empresas = await userRes.json();
        const companyIds = empresas.map((e: any) => e.id);
        const result = await sendLocationToApi(latitude, longitude, companyIds);
        if (!result.success) console.warn('Envio falhou:', result.error);
      }
    }
  } catch (e: any) {
    console.error('Erro ao processar location task:', e);
  }
});
