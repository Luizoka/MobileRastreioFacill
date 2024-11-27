import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import {
  requestForegroundPermissionsAsync,
  getCurrentPositionAsync,
  LocationObject,
  watchPositionAsync,
  LocationAccuracy
} from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { styles } from '../styles/styles';
import { startBackgroundUpdate, stopBackgroundUpdate } from '../../locationTask'; // Importar funções de rastreamento
import { getToken } from '../utils/auth';

const MapScreen = ({ onLogout }: { onLogout: () => void }) => {
  const [location, setLocation] = useState<LocationObject | null>(null);
  const [isTracking, setIsTracking] = useState<boolean>(false); // Desligado por padrão

  const mapRef = useRef<MapView>(null);

  async function requestLocationPermissions() {
    const { granted } = await requestForegroundPermissionsAsync();

    if (granted) {
      const currentPosition = await getCurrentPositionAsync();
      setLocation(currentPosition);
    }
  }

  async function sendCurrentLocation(latitude: string, longitude: string) {
    const token = await getToken();
    if (!token) {
      console.error('Token not found');
      return;
    }

    try {
      const response = await fetch('http://192.168.31.10:3000/api/funcionario/adicionar-historico-localizacao', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ latitude, longitude }),
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
        if (data.error === 'Nenhum vínculo ativo encontrado.') {
          console.error('Error: Nenhum vínculo ativo encontrado.');
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
      const response = await fetch('http://192.168.31.10:3000/api/funcionario/adicionar-historico-localizacao', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ latitude, longitude }),
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
        if (data.error === 'Nenhum vínculo ativo encontrado.') {
          console.error('Error: Nenhum vínculo ativo encontrado.');
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

  useEffect(() => {
    requestLocationPermissions();
  }, []);

  useEffect(() => {
    let subscription: any = null;
    if (isTracking) {
      (async () => {
        subscription = await watchPositionAsync({
          accuracy: LocationAccuracy.Highest,
          timeInterval: 1000,
          distanceInterval: 1
        }, (response) => {
          setLocation(response);
          console.log('Received new locations in foreground:', response);
          mapRef.current?.animateCamera({
            center: response.coords
          });

          // Enviar localização atual e adicionar ao histórico
          sendCurrentLocation(response.coords.latitude.toString(), response.coords.longitude.toString());
          addLocationToHistory(response.coords.latitude.toString(), response.coords.longitude.toString());
        });
        await startBackgroundUpdate(); // Iniciar rastreamento em segundo plano
      })();
    } else {
      stopBackgroundUpdate(); // Parar rastreamento em segundo plano
    }
    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [isTracking]);

  const handleLogout = async () => {
    setIsTracking(false); // Parar o rastreamento ao fazer logout
    await AsyncStorage.removeItem('username');
    await AsyncStorage.removeItem('password');
    onLogout();
  };

  return (
    <View style={styles.container}>
      <View style={localStyles.buttonContainer}>
        <TouchableOpacity onPress={() => setIsTracking(!isTracking)}>
          <Image
            source={isTracking ? require('../../assets/botao_desligado.png') : require('../../assets/botao_ligado.png')}
            style={localStyles.buttonImage}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={localStyles.logoutButton}>Logout</Text>
        </TouchableOpacity>
      </View>
      {
        isTracking ? (
          location && (
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={{
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005
              }}
            >
              <Marker
                coordinate={{
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                }}
              />
            </MapView>
          )
        ) : (
          <Text>Você está desconectado</Text>
        )
      }
    </View>
  );
};

const localStyles = StyleSheet.create({
  buttonContainer: {
    position: 'absolute',
    top: 50,
    left: 10,
    right: 10,
    zIndex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  buttonImage: {
    width: 50, // Ajuste conforme necessário
    height: 50, // Ajuste conforme necessário
  },
  logoutButton: {
    color: 'red',
    fontSize: 16,
    fontWeight: 'bold',
    // fontFamily: 'Poppins-Regular', // Comentado temporariamente
  },
});

export default MapScreen;