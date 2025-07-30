import React, { useState, useEffect, useCallback } from 'react';
import { initDb } from './src/utils/database';
import { View, StyleSheet, Modal, Text, Button } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HallScreen from './src/screens/HallScreen';
import './src/tasks/LocationTask';
import { stopBackgroundUpdate } from './src/tasks/LocationTask';
import { getValidToken, clearAllAuthData } from './src/utils/auth';
import { requestForegroundPermissionsAsync, requestBackgroundPermissionsAsync } from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import { syncPendingLocations } from './src/utils/sync';

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(true);
  const [dbReady, setDbReady] = useState(false);

useEffect(() => {
  const setup = async () => {
    console.log('🚀 Chamando initDb...');
    await initDb();
    console.log('✅ initDb finalizado com sucesso.');
    setDbReady(true);

    const unsubscribeNetInfo = NetInfo.addEventListener(state => {
      console.log("Olha o state: ", state.isConnected)
      if (state.isConnected) {
        syncPendingLocations();
      }
    });

    return () => unsubscribeNetInfo();
  };

  setup();
}, []);

  // Verifica login e solicita permissões
  useEffect(() => {
    const bootstrap = async () => {
      try {
        const validToken = await getValidToken();
        setIsLoggedIn(!!validToken);
      } catch {
        await clearAllAuthData();
        setIsLoggedIn(false);
      }

      try {
        const { status: fgStatus } = await requestForegroundPermissionsAsync();
        if (fgStatus !== 'granted') {
          alert('Permissão para acessar localização foi negada');
          return;
        }
        const { status: bgStatus } = await requestBackgroundPermissionsAsync();
        if (bgStatus !== 'granted') {
          alert('Permissão para acessar localização em segundo plano foi negada');
          return;
        }
        setIsModalVisible(false);
      } catch (err) {
        console.error('Erro ao solicitar permissões:', err);
      }
    };

    bootstrap();
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

  if (!fontsLoaded || !dbReady) return null;

  return (
    <View style={styles.container} onLayout={onLayoutRootView}>
      <Modal
        animationType="slide"
        transparent
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(prev => !prev)}
      >
        <View style={styles.modalView}>
          <Text style={styles.modalText}>
            Precisamos da sua permissão para acessar sua localização em segundo plano.
          </Text>
          <Button
            title="Conceder Permissão"
            onPress={async () => {
              const { status: fgStatus } = await requestForegroundPermissionsAsync();
              if (fgStatus !== 'granted') {
                alert('Permissão para acessar a localização foi negada.');
                return;
              }
              const { status: bgStatus } = await requestBackgroundPermissionsAsync();
              if (bgStatus !== 'granted') {
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
          onNavigateToMap={id_empresa => console.log(`Map: ${id_empresa}`)}
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
  container: { flex: 1 },
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
