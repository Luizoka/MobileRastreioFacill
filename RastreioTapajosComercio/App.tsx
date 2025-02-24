import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Modal, Text, Button } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HallScreen from './src/screens/HallScreen';
import MapScreen from './src/screens/MapScreen';
import { stopBackgroundUpdate } from './src/tasks/LocationTask'; // Atualizar o caminho da importação
import { getToken, isTokenValid, removeToken } from './src/utils/auth';
import { requestForegroundPermissionsAsync, requestBackgroundPermissionsAsync } from 'expo-location';

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isInHall, setIsInHall] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(true); // Temporariamente definido como true para depuração
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<number | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(true);

  useEffect(() => {
    const checkLoginStatus = async () => {
      const token = await getToken();
      if (token && isTokenValid(token)) {
        setIsLoggedIn(true);
      } else {
        await removeToken();
        setIsLoggedIn(false);
      }
    };

    const requestLocationPermissions = async () => {
      console.log('Requesting location permissions');
      try {
        const { status: foregroundStatus } = await requestForegroundPermissionsAsync();
        if (foregroundStatus !== 'granted') {
          alert('Permission to access location was denied');
          return;
        }

        const { status: backgroundStatus } = await requestBackgroundPermissionsAsync();
        if (backgroundStatus !== 'granted') {
          alert('Permission to access background location was denied');
          return;
        }

        setIsModalVisible(false);
      } catch (error) {
        console.error('Error requesting location permissions:', error);
      }
    };

    checkLoginStatus();
    requestLocationPermissions();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  const handleLogout = async () => {
    await removeToken();
    await stopBackgroundUpdate(); // Parar o rastreamento de localização em segundo plano
    setIsLoggedIn(false);
    setIsInHall(false);
  };

  const handleBackToHall = () => {
    setIsInHall(true);
  };

  const handleNavigateToMap = (id_empresa: number) => {
    setSelectedEmpresaId(id_empresa);
    setIsInHall(false);
  };

  if (!fontsLoaded) {
    console.log('Fonts not loaded');
    return null;
  }

  console.log('Rendering App component');

  return (
    <View style={styles.container} onLayout={onLayoutRootView}>
      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => {
          setIsModalVisible(!isModalVisible);
        }}
      >
        <View style={styles.modalView}>
          <Text style={styles.modalText}>We need your permission to access your location all the time, even in the background.</Text>
          <Button title="Grant Permission" onPress={async () => {
            const { status: foregroundStatus } = await requestForegroundPermissionsAsync();
            if (foregroundStatus !== 'granted') {
              alert('Permission to access location was denied');
              return;
            }

            const { status: backgroundStatus } = await requestBackgroundPermissionsAsync();
            if (backgroundStatus !== 'granted') {
              alert('Permission to access background location was denied');
              return;
            }

            setIsModalVisible(false);
          }} />
        </View>
      </Modal>
      {isLoggedIn ? (
        isInHall ? (
          <HallScreen onNavigateToMap={handleNavigateToMap} onLogout={handleLogout} onNavigateToLogin={() => setIsLoggedIn(false)} />
        ) : (
          <MapScreen onLogout={handleBackToHall} id_empresa={selectedEmpresaId} />
        )
      ) : isRegistering ? (
        <RegisterScreen onRegister={() => setIsRegistering(false)} onNavigateToLogin={() => setIsRegistering(false)} />
      ) : (
        <LoginScreen onLogin={() => { setIsLoggedIn(true); setIsInHall(true); }} onNavigateToRegister={() => setIsRegistering(true)} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalText: {
    marginBottom: 15,
    textAlign: 'center',
  },
});

export default App;