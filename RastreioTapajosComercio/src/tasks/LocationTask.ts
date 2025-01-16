import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { getToken } from '../utils/auth';
import { API_BASE_URL } from '@env';

export const LOCATION_TASK_NAME = 'background-location-task';

// Definindo a tarefa do TaskManager no escopo global
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('TaskManager error:', error);
    return;
  }
  if (data) {
    const { locations } = data as any;
    if (locations && locations.length > 0) {
      const { latitude, longitude } = locations[0].coords;
      await sendCurrentLocation(latitude, longitude);
    }
  }
});

async function sendCurrentLocation(latitude: number, longitude: number) {
  const token = await getToken();
  if (!token) {
    console.error('Token not found');
    return;
  }

  try {
    console.log('Sending current location:', { latitude, longitude });
    const response = await fetch(`${API_BASE_URL}/api/funcionario/enviar-localizacao-atual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ latitude, longitude })
    });
    if (!response.ok) {
      console.error('Failed to send location:', response.statusText);
    }
  } catch (error) {
    console.error('Error sending location:', error);
  }
}

export async function startBackgroundUpdate() {
  const { granted } = await Location.getBackgroundPermissionsAsync();
  if (!granted) {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Background location permission not granted');
      return;
    }
  }

  try {
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Highest,
      timeInterval: 1000,
      distanceInterval: 1,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Location Tracking',
        notificationBody: 'We are tracking your location in the background',
        notificationColor: '#fff',
      },
    });
    console.log('Background location tracking started');
  } catch (error) {
    console.error('Error starting background location updates:', error);
  }
}

export async function stopBackgroundUpdate() {
  try {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    console.log('Background location updates stopped.');
  } catch (error) {
    console.error('Error stopping background location updates:', error);
  }
}