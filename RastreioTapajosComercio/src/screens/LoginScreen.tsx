import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Image, ImageBackground } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { startBackgroundUpdate } from '../tasks/LocationTask'; // Corrigir o caminho da importação
import { API_BASE_URL } from '@env';

const LoginScreen = ({ onLogin, onNavigateToRegister }: { onLogin: () => void, onNavigateToRegister: () => void }) => {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async () => {
    console.log('Attempting to log in with:', { email, senha });
    try {
      const response = await fetch(`${API_BASE_URL}/api/funcionario/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, senha }),
      });
  
      console.log('API response status:', response.status);
  
      if (response.status === 200) {
        const data = await response.json();
        console.log('Login response:', data);
        const { token } = data;
        await AsyncStorage.setItem('token', token);
        await startBackgroundUpdate(); // Iniciar o rastreamento de localização em segundo plano
        onLogin();
      } else if (response.status === 401) {
        const data = await response.json();
        console.error('Login error:', data.error);
        setError('Login failed. Please check your credentials.');
      } else {
        console.error('Login error:', response.statusText);
        setError('Login failed. Please try again.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Login failed. Please check your credentials.');
    }
  };

  return (
    <ImageBackground source={require('../../assets/MOBILE.png')} style={styles.background}>
      <View style={styles.container}>
        <Image source={require('../../assets/LOGO_1.png')} style={styles.logo} />
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          placeholderTextColor="#007bff"
        />
        <TextInput
          style={styles.input}
          placeholder="Senha"
          value={senha}
          onChangeText={setSenha}
          secureTextEntry
          placeholderTextColor="#007bff"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.buttonContainer}>
          <Button title="Entrar" onPress={handleLogin} color="#007bff" />
        </View>
        <View style={styles.buttonSpacing} />
        <View style={styles.buttonContainer}>
          <Button title="Cadastro" onPress={onNavigateToRegister} color="#007bff" />
        </View>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    resizeMode: 'cover',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  logo: {
    width: 300, // Adjust the width as needed
    height: 105, // Adjust the height as needed
    alignSelf: 'center',
    marginBottom: 20,
  },
  input: {
    height: 40,
    borderColor: '#007bff',
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 12,
    paddingHorizontal: 8,
    color: '#007bff',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  error: {
    color: 'red',
    marginBottom: 12,
    textAlign: 'center',
  },
  buttonSpacing: {
    height: 10, // Adjust the height as needed for spacing
  },
  buttonContainer: {
    borderRadius: 10,
    overflow: 'hidden',
  },
});

export default LoginScreen;