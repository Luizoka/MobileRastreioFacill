import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Image } from 'react-native';
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
    <View style={styles.container}>
      <Image source={require('../../assets/LOGO_1.png')} style={styles.logo} />
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Senha"
        value={senha}
        onChangeText={setSenha}
        secureTextEntry
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Entrar" onPress={handleLogin} />
      <View style={styles.buttonSpacing} />
      <Button title="Cadastro" onPress={onNavigateToRegister} />
    </View>
  );
};

const styles = StyleSheet.create({
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
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 12,
    paddingHorizontal: 8,
    // fontFamily: 'Poppins-Regular', // Comentado temporariamente
  },
  error: {
    color: 'red',
    marginBottom: 12,
    // fontFamily: 'Poppins-Regular', // Comentado temporariamente
  },
  buttonSpacing: {
    height: 10, // Adjust the height as needed for spacing
  },
});

export default LoginScreen;