import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Modal, Text, Button } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HallScreen from './src/screens/HallScreen';
import './src/tasks/LocationTask';
import { stopBackgroundUpdate } from './src/tasks/LocationTask'; // Atualizar o caminho da importação
import { getValidToken, clearAllAuthData } from './src/utils/auth';
import { requestForegroundPermissionsAsync, requestBackgroundPermissionsAsync } from 'expo-location';

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(true);

  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        // Usar a nova função que verifica e renova tokens automaticamente
        const validToken = await getValidToken();
        if (validToken) {
          setIsLoggedIn(true);
        } else {
          await clearAllAuthData();
          setIsLoggedIn(false);
        }
      } catch (error) {
        console.error('Erro ao verificar status de login:', error);
        await clearAllAuthData();
        setIsLoggedIn(false);
      }
    };

    const requestLocationPermissions = async () => {
      try {
        const { status: foregroundStatus } = await requestForegroundPermissionsAsync();
        if (foregroundStatus !== 'granted') {
          alert('Permissão para acessar localização foi negada');
          return;
        }

        const { status: backgroundStatus } = await requestBackgroundPermissionsAsync();
        if (backgroundStatus !== 'granted') {
          alert('Permissão para acessar localização em segundo plano foi negada');
          return;
        }

        setIsModalVisible(false);
      } catch (error) {
        console.error('Erro ao solicitar permissões de localização:', error);
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
    await clearAllAuthData();
    await stopBackgroundUpdate();
    setIsLoggedIn(false);
  };

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={styles.container} onLayout={onLayoutRootView}>
      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(!isModalVisible)}
      >
        <View style={styles.modalView}>
          <Text style={styles.modalText}>
            Precisamos da sua permissão para acessar sua localização em segundo plano.
          </Text>
          <Button
            title="Conceder Permissão"
            onPress={async () => {
              const { status: foregroundStatus } = await requestForegroundPermissionsAsync();
              if (foregroundStatus !== 'granted') {
                alert('Permissão para acessar a localização foi negada.');
                return;
              }
              const { status: backgroundStatus } = await requestBackgroundPermissionsAsync();
              if (backgroundStatus !== 'granted') {
                alert('Permissão para acessar a localização em segundo plano foi negada.');
                return;
              }
              setIsModalVisible(false);
            }}
          />
        </View>
      </Modal>

      {isLoggedIn ? (
        <HallScreen
          onLogout={handleLogout}
          onNavigateToLogin={() => setIsLoggedIn(false)}
          onNavigateToMap={(id_empresa: number) => {
            // Add your navigation logic here
            console.log(`Navigating to map with id_empresa: ${id_empresa}`);
          }}
        />
      ) : isRegistering ? (
        <RegisterScreen
          onRegister={() => setIsRegistering(false)}
          onNavigateToLogin={() => setIsRegistering(false)}
        />
      ) : (
        <LoginScreen
          onLogin={() => setIsLoggedIn(true)}
          onNavigateToRegister={() => setIsRegistering(true)}
        />
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
    shadowOffset: { width: 0, height: 2 },
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