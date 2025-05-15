import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { getToken } from '../utils/auth';
import { API_BASE_URL } from '@env';

export const LOCATION_TASK_NAME = 'background-location-task';

// Variável que indica se o rastreamento em segundo plano está ativo
export let isBackgroundTrackingActive = false;

// Função para verificar se o rastreamento em segundo plano está disponível
export const checkBackgroundLocationAvailable = async () => {
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

// Função para iniciar o rastreamento em segundo plano
export const startBackgroundUpdate = async () => {
  try {
    const hasPermissions = await checkBackgroundLocationAvailable();
    if (!hasPermissions) {
      console.log('Permissões de localização em segundo plano não concedidas');
      return false;
    }

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 200,
      timeInterval: 180000,
      deferredUpdatesInterval: 300000,
      deferredUpdatesDistance: 500,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Rastreio Fácil',
        notificationBody: 'Rastreamento otimizado para economia de bateria',
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

// Função para parar o rastreamento em segundo plano
export const stopBackgroundUpdate = async () => {
  try {
    if (await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME)) {
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

// Função para enviar localização para a API
export const sendLocationToApi = async (latitude: string | number, longitude: string | number, companyIds: number[]) => {
  console.log("🚀 INÍCIO sendLocationToApi:", { latitude, longitude, companyIds });
  
  const token = await getToken();
  if (!token) {
    console.error("❌ Token não encontrado");
    return { success: false, error: "Token não encontrado" };
  }

  try {
    // Decodificar o token para obter o ID do usuário
    const tokenParts = token.split('.');
    console.log("🔑 Partes do token:", tokenParts.length);

    if (tokenParts.length !== 3) {
      console.error("❌ Formato de token inválido");
      return { success: false, error: "Formato de token inválido" };
    }

    try {
      const base64Url = tokenParts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const payload = JSON.parse(jsonPayload);
      console.log("🔑 Payload do token:", payload);
      
      if (!payload.id) {
        console.error("❌ ID do usuário não encontrado no token");
        return { success: false, error: "ID do usuário não encontrado no token" };
      }
      
      const userId = payload.id;
      console.log("👤 ID do usuário extraído:", userId);
      
      // Converter latitude e longitude para números se forem strings
      const numLatitude = typeof latitude === 'string' ? parseFloat(latitude) : latitude;
      const numLongitude = typeof longitude === 'string' ? parseFloat(longitude) : longitude;

      // Preparar o body com o formato correto
      const requestBody = {
        user_id: userId,
        latitude: numLatitude,
        longitude: numLongitude,
        company_ids: companyIds
      };

      console.log("📤 Dados enviados para API:", JSON.stringify(requestBody));

      const response = await fetch(`${API_BASE_URL}/api/location-histories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      console.log("📡 Status da resposta:", response.status);
      const responseText = await response.text();
      console.log("📥 Resposta bruta da API:", responseText);
      
      let data;

      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error("❌ Erro ao analisar resposta JSON:", e);
        return { success: false, error: "Erro ao analisar resposta" };
      }

      if (response.status === 201) {
        console.log("✅ Localização enviada com sucesso:", data);
        
        // Verificar se há erros mesmo com status 201
        if (data.errors && data.errors.length > 0) {
          console.warn("⚠️ Localização enviada, mas com avisos:", data.errors);
          return { success: true, warnings: data.errors };
        }
        
        return { success: true, data };
      } else {
        console.error(`❌ Erro (${response.status}):`, data.error || "Erro desconhecido");
        return { success: false, error: data.error, status: response.status };
      }
    } catch (e) {
      console.error("❌ Erro ao decodificar token:", e);
      return { success: false, error: "Erro ao decodificar token" };
    }
  } catch (error) {
    console.error("❌ Exceção ao enviar localização:", error);
    if (error instanceof Error) {
      console.error("❌ Detalhes do erro:", error.message);
      console.error("❌ Stack trace:", error.stack);
    }
    return { success: false, error: "Erro ao enviar localização" };
  }
};

// Definição da tarefa em segundo plano
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Erro na tarefa de localização em segundo plano:', error);
    return;
  }
  
  if (!data) {
    console.error('Sem dados na tarefa de localização');
    return;
  }
  
  const { locations } = data as { locations: Location.LocationObject[] };
  const location = locations[0];
  
  if (!location) {
    console.error('Localização não disponível');
    return;
  }

  try {
    const token = await getToken();
    if (!token) {
      console.error("Token não encontrado na tarefa em segundo plano");
      return;
    }

    const tokenParts = token.split('.');
    const payload = JSON.parse(atob(tokenParts[1]));
    const userId = payload.id;

    // Buscar empresas ativas para este usuário
    const response = await fetch(`${API_BASE_URL}/api/user-role-companies/user/${userId}/role?role=employee`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 200) {
      const empresas = await response.json();
      if (empresas.length > 0) {
        const companyIds = empresas.map((empresa: any) => empresa.id);
        
        // Enviar localização para todas as empresas vinculadas
        await sendLocationToApi(
          location.coords.latitude.toString(),
          location.coords.longitude.toString(),
          companyIds
        );
      }
    }
  } catch (error: any) {
    console.error('❌ Erro ao processar localização em segundo plano (detalhado):', {
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
      toString: error?.toString(),
      ...(error instanceof TypeError && { isTypeError: true })
    });
  }
});