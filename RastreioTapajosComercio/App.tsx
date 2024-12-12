import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HallScreen from './src/screens/HallScreen';
import MapScreen from './src/screens/MapScreen';
import { stopBackgroundUpdate } from './locationTask'; // Importar a função de parar o rastreamento
import { getToken, isTokenValid, removeToken } from './src/utils/auth';

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isInHall, setIsInHall] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<number | null>(null);

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
    return null;
  }

  return (
    <View style={styles.container} onLayout={onLayoutRootView}>
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
});

export default App;