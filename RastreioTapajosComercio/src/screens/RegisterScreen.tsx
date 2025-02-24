import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Image, ImageBackground } from 'react-native';
import { API_BASE_URL } from '@env';

const RegisterScreen = ({ onRegister, onNavigateToLogin }: { onRegister: () => void, onNavigateToLogin: () => void }) => {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleRegister = async () => {
    console.log('Attempting to register with:', { nome, email, senha });
    try {
      const response = await fetch(`${API_BASE_URL}/api/funcionario/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nome, email, senha }),
      });

      if (response.status === 201) {
        const data = await response.json();
        console.log('Register response:', data);
        setMessage('Funcionário registrado com sucesso');
        onRegister();
      } else {
        const data = await response.json();
        console.error('Register error:', data.error);
        setError('Registration failed. Please try again.');
      }
    } catch (err) {
      console.error('Register error:', err);
      setError('Registration failed. Please check your credentials.');
    }
  };

  return (
    <ImageBackground source={require('../../assets/MOBILE.png')} style={styles.background}>
      <View style={styles.container}>
        <Image source={require('../../assets/LOGO_1.png')} style={styles.logo} />
        <TextInput
          style={styles.input}
          placeholder="Nome"
          value={nome}
          onChangeText={setNome}
          placeholderTextColor="#007bff"
        />
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
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <View style={styles.buttonContainer}>
          <Button title="Registrar" onPress={handleRegister} color="#007bff" />
        </View>
        <View style={styles.buttonSpacing} />
        <View style={styles.buttonContainer}>
          <Button title="Voltar" onPress={onNavigateToLogin} color="#007bff" />
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
  message: {
    color: 'green',
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

export default RegisterScreen;