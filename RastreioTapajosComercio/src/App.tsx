import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import MapScreen from './screens/MapScreen';
import { stopBackgroundUpdate } from '../locationTask'; // Importar a função de parar o rastreamento
import { getToken } from '../src/utils/auth';

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    const checkLoginStatus = async () => {
      const token = await getToken();
      if (token) {
        setIsLoggedIn(true);
      }
    };

    const loadResources = async () => {
      try {
        // await Font.loadAsync({
        //   'Poppins-Regular': require('./fonts/Poppins-Regular.ttf'), // Substitua pelo caminho correto da sua fonte
        // });
      } catch (e) {
        console.warn(e);
      } finally {
        setFontsLoaded(true);
      }
    };

    loadResources();
    checkLoginStatus();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('username');
    await AsyncStorage.removeItem('password');
    await stopBackgroundUpdate(); // Parar o rastreamento de localização em segundo plano
    setIsLoggedIn(false);
  };

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={styles.container} onLayout={onLayoutRootView}>
      {isLoggedIn ? (
        <MapScreen onLogout={handleLogout} />
      ) : isRegistering ? (
        <RegisterScreen onRegister={() => setIsRegistering(false)} onNavigateToLogin={() => setIsRegistering(false)} />
      ) : (
        <LoginScreen onLogin={() => setIsLoggedIn(true)} onNavigateToRegister={() => setIsRegistering(true)} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;