import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import {
  getCurrentPositionAsync,
  LocationObject,
  watchPositionAsync,
  LocationAccuracy,
  startLocationUpdatesAsync,
  stopLocationUpdatesAsync
} from 'expo-location';
import { styles } from '../styles/styles';
import { getToken } from '../utils/auth';
import { API_BASE_URL } from '@env';
import { LOCATION_TASK_NAME } from '../tasks/LocationTask';

const MapScreen = ({ onLogout, id_empresa }: { onLogout: () => void, id_empresa: number | null }) => {
  console.log('MapScreen rendered with id_empresa:', id_empresa);
  const [location, setLocation] = useState<LocationObject | null>(null);
  const [isTracking, setIsTracking] = useState<boolean>(false); // Desligado por padrão

  async function sendCurrentLocation(latitude: string, longitude: string) {
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
        body: JSON.stringify({ latitude, longitude, id_empresa }),
      });
  
      if (response.status === 500) {
        const data = await response.json();
        if (data.error === 'Erro ao buscar vínculo do funcionário.') {
          console.error('Error: Erro ao buscar vínculo do funcionário.');
        } else if (data.error === 'Erro ao atualizar a localização atual.') {
          console.error('Error: Erro ao atualizar a localização atual.');
        } else {
          console.error('Error: Erro desconhecido ao enviar localização.');
        }
      } else if (response.status === 404) {
        const data = await response.json();
        if (data.error === 'Nenhum vínculo ativo encontrado para a empresa especificada.') {
          console.error('Error: Nenhum vínculo ativo encontrado para a empresa especificada.');
        } else {
          console.error('Error: Erro desconhecido ao enviar localização.');
        }
      } else {
        const data = await response.json();
        console.log('Current location response:', data);
      }
    } catch (error) {
      console.error('Error sending current location:', error);
    }
  }

  async function addLocationToHistory(latitude: string, longitude: string) {
    const token = await getToken();
    if (!token) {
      console.error('Token not found');
      return;
    }

    try {
      console.log('Adding location to history:', { latitude, longitude });
      const response = await fetch(`${API_BASE_URL}/api/funcionario/adicionar-historico-localizacao`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ latitude, longitude, id_empresa }),
      });

      if (response.status === 500) {
        const data = await response.json();
        if (data.error === 'Erro ao buscar vínculo do funcionário.') {
          console.error('Error: Erro ao buscar vínculo do funcionário.');
        } else if (data.error === 'Erro ao adicionar ao histórico de localizações.') {
          console.error('Error: Erro ao adicionar ao histórico de localizações.');
        } else {
          console.error('Error: Erro desconhecido ao adicionar ao histórico.');
        }
      } else if (response.status === 404) {
        const data = await response.json();
        if (data.error === 'Nenhum vínculo ativo encontrado para a empresa especificada.') {
          console.error('Error: Nenhum vínculo ativo encontrado para a empresa especificada.');
        } else {
          console.error('Error: Erro desconhecido ao adicionar ao histórico.');
        }
      } else {
        const data = await response.json();
        console.log('Location history response:', data);
      }
    } catch (error) {
      console.error('Error adding location to history:', error);
    }
  }

  async function activateApp() {
    const token = await getToken();
    if (!token) {
      console.error('Token not found');
      return;
    }

    try {
      console.log('Activating app');
      const response = await fetch(`${API_BASE_URL}/api/funcionario/ativar-app`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id_empresa }),
      });

      if (response.status === 200) {
        const data = await response.json();
        console.log('App activation response:', data);
      } else if (response.status === 500) {
        const data = await response.json();
        console.error('Error:', data.error);
      }
    } catch (error) {
      console.error('Error activating app:', error);
    }
  }

  async function deactivateApp() {
    const token = await getToken();
    if (!token) {
      console.error('Token not found');
      return;
    }

    try {
      console.log('Deactivating app');
      const response = await fetch(`${API_BASE_URL}/api/funcionario/desativar-app`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id_empresa }),
      });

      if (response.status === 200) {
        const data = await response.json();
        console.log('App deactivation response:', data);
      } else if (response.status === 500) {
        const data = await response.json();
        console.error('Error:', data.error);
      }
    } catch (error) {
      console.error('Error deactivating app:', error);
    }
  }

  useEffect(() => {
    const requestLocationPermissions = async () => {
      console.log('Requesting location permissions');
      try {
        const currentPosition = await getCurrentPositionAsync();
        console.log('Current position:', currentPosition);
        setLocation(currentPosition);
      } catch (error) {
        console.error('Error requesting location permissions:', error);
      }
    };

    requestLocationPermissions();
  }, []);

  useEffect(() => {
    let subscription: any = null;
    if (isTracking) {
      (async () => {
        console.log('Starting watchPositionAsync');
        try {
          subscription = await watchPositionAsync({
            accuracy: LocationAccuracy.Highest,
            timeInterval: 10000,
            distanceInterval: 1
          }, (response) => {
            console.log('Received new locations in foreground:', response);
            setLocation(response);

            // Enviar localização atual e adicionar ao histórico
            sendCurrentLocation(response.coords.latitude.toString(), response.coords.longitude.toString());
            addLocationToHistory(response.coords.latitude.toString(), response.coords.longitude.toString());
          });
        } catch (error) {
          console.error('Error starting watchPositionAsync:', error);
        }
      })();
    }
    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [isTracking]);

  const handleToggleTracking = async () => {
    console.log('Toggling tracking');
    try {
      if (isTracking) {
        console.log('Deactivating app');
        await deactivateApp();
        await stopLocationUpdatesAsync(LOCATION_TASK_NAME); // Parar a tarefa de localização em segundo plano
      } else {
        console.log('Activating app');
        await activateApp();
        await startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: LocationAccuracy.High,
          distanceInterval: 100, // Enviar localização a cada 100 metros
        }); // Iniciar a tarefa de localização em segundo plano
      }
      setIsTracking(!isTracking);
    } catch (error) {
      console.error('Error toggling tracking:', error);
    }
  };

  const handleBack = async () => {
    console.log('Handling back');
    setIsTracking(false); // Parar o rastreamento ao voltar para o Hall
    onLogout();
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={localStyles.backButton} onPress={handleBack}>
        <Text style={localStyles.logoutButton}>Voltar</Text>
      </TouchableOpacity>
      <View style={localStyles.buttonContainer}>
        <TouchableOpacity onPress={handleToggleTracking}>
          <Image
            source={isTracking ? require('../../assets/botao_ligado.png') : require('../../assets/botao_desligado.png')}
            style={localStyles.buttonImage}
          />
        </TouchableOpacity>
        {isTracking ? (
          <Text style={localStyles.trackingOnText}>Rastreamento ligado</Text>
        ) : (
          <Text style={localStyles.trackingOffText}>Rastreamento desligado</Text>
        )}
      </View>
    </View>
  );
};

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  buttonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonImage: {
    width: 100,
    height: 100,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    right: 16,
  },
  logoutButton: {
    fontSize: 20,
    color: 'blue',
  },
  trackingOnText: {
    fontSize: 16,
    color: 'green',
    textAlign: 'center',
    marginTop: 20,
  },
  trackingOffText: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
    marginTop: 20,
  },
});

export default MapScreen;