import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Image } from 'react-native';
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
    <View style={styles.container}>
      <Image source={require('../../assets/LOGO_1.png')} style={styles.logo} />
      <TextInput
        style={styles.input}
        placeholder="Nome"
        value={nome}
        onChangeText={setNome}
      />
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
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <Button title="Registrar" onPress={handleRegister} />
      <View style={styles.buttonSpacing} />
      <Button title="Voltar" onPress={onNavigateToLogin} />
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
  message: {
    color: 'green',
    marginBottom: 12,
    // fontFamily: 'Poppins-Regular', // Comentado temporariamente
  },
  buttonSpacing: {
    height: 10, // Adjust the height as needed for spacing
  },
});

export default RegisterScreen;