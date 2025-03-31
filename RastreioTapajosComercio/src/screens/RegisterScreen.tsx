import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  Image, 
  ImageBackground, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform, 
  StatusBar,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback
} from 'react-native';
import { API_BASE_URL } from '@env';

const RegisterScreen = ({ onRegister, onNavigateToLogin }: { onRegister: () => void, onNavigateToLogin: () => void }) => {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [contato, setContato] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const handleRegister = async () => {
    if (!nome || !email || !senha || !contato) {
      setError('Por favor, preencha todos os campos');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    console.log('Tentando cadastrar usuário com:', { nome, email, senha, contato });
    try {
      const response = await fetch(`${API_BASE_URL}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          name: nome, 
          email, 
          password: senha, 
          contact: contato,
          plans_id: 1  // Valor padrão conforme solicitado
        }),
      });

      // Obtenha a resposta como texto primeiro para depuração
      const responseText = await response.text();
      console.log('Resposta bruta:', responseText);
      
      // Tente analisar a resposta como JSON, se possível
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Erro ao analisar resposta JSON:', e);
        setError('Erro ao processar resposta do servidor');
        setLoading(false);
        return;
      }

      if (response.status === 201) {
        console.log('Resposta de cadastro:', data);
        setSuccess(`Conta criada com sucesso! Verifique sua conta de email ${email} para confirmar seu cadastro.`);
        
        // Resetar os campos após o registro bem-sucedido
        setNome('');
        setEmail('');
        setSenha('');
        setContato('');
        
        // Aguardar alguns segundos antes de redirecionar para o login
        setTimeout(() => {
          onNavigateToLogin();
        }, 5000); // 5 segundos
      } else if (response.status === 400) {
        console.error('Erro de validação:', data.error);
        
        // Processar erros de validação
        if (Array.isArray(data.error)) {
          const errorMessages = data.error.map((err: any) => {
            if (err.path.includes('email')) {
              return 'Email inválido';
            } else if (err.path.includes('plans_id')) {
              return 'Plano inválido';
            } else {
              return err.message || 'Erro de validação';
            }
          });
          setError(errorMessages.join('. '));
        } else {
          setError(data.error || 'Dados inválidos. Verifique as informações fornecidas.');
        }
      } else if (response.status === 500) {
        console.error('Erro no servidor:', data);
        setError('Erro no servidor. Tente novamente mais tarde.');
      } else {
        console.error('Erro não esperado:', data);
        setError(data.error || 'Falha no cadastro. Tente novamente.');
      }
    } catch (err) {
      console.error('Erro na requisição:', err);
      setError('Falha no cadastro. Verifique sua conexão com a internet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <StatusBar backgroundColor="transparent" translucent barStyle="light-content" />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <SafeAreaView style={styles.safeAreaContainer}>
          <ImageBackground 
            source={require('../../assets/MOBILE.png')} 
            style={styles.background}
            resizeMode="cover"
          >
            {Platform.OS === 'ios' ? (
              <KeyboardAvoidingView
                behavior="padding"
                style={styles.keyboardAvoidingView}
                keyboardVerticalOffset={20}
              >
                <ScrollView 
                  contentContainerStyle={[
                    styles.scrollContainer,
                    keyboardVisible && styles.scrollContainerKeyboardVisible
                  ]}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                >
                  {renderContent()}
                </ScrollView>
              </KeyboardAvoidingView>
            ) : (
              <ScrollView 
                contentContainerStyle={styles.scrollContainer}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                {renderContent()}
              </ScrollView>
            )}
          </ImageBackground>
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </>
  );

  function renderContent() {
    return (
      <>
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../assets/LOGO_1.png')} 
            style={styles.logo} 
            resizeMode="contain"
          />
        </View>
        
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Criar Conta</Text>
          
          <TextInput
            style={styles.input}
            placeholder="Nome Completo"
            value={nome}
            onChangeText={setNome}
            placeholderTextColor="#8BA6C1"
            autoCapitalize="words"
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            placeholderTextColor="#8BA6C1"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Senha"
            value={senha}
            onChangeText={setSenha}
            secureTextEntry
            placeholderTextColor="#8BA6C1"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Telefone/Contato"
            value={contato}
            onChangeText={setContato}
            placeholderTextColor="#8BA6C1"
            keyboardType="phone-pad"
          />
          
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          
          {success ? (
            <View style={styles.successContainer}>
              <Text style={styles.successText}>{success}</Text>
            </View>
          ) : null}
          
          <TouchableOpacity 
            style={styles.registerButton}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.registerButtonText}>Cadastrar</Text>
            )}
          </TouchableOpacity>
          
          <View style={styles.loginLinkContainer}>
            <Text style={styles.loginText}>Já tem uma conta?</Text>
            <TouchableOpacity onPress={onNavigateToLogin}>
              <Text style={styles.loginLink}>Faça login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  }
};

const styles = StyleSheet.create({
  safeAreaContainer: {
    flex: 1,
  },
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight! + 40 : 60,
    paddingBottom: 40,
  },
  scrollContainerKeyboardVisible: {
    justifyContent: 'flex-start',
    paddingTop: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    width: 280,
    height: 100,
  },
  formContainer: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderColor: '#E0E0E0',
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 16,
    paddingHorizontal: 16,
    color: '#333',
    fontSize: 16,
  },
  errorContainer: {
    backgroundColor: 'rgba(220, 53, 69, 0.1)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#dc3545',
    textAlign: 'center',
    fontSize: 14,
  },
  successContainer: {
    backgroundColor: 'rgba(40, 167, 69, 0.1)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  successText: {
    color: '#28a745',
    textAlign: 'center',
    fontSize: 14,
  },
  registerButton: {
    backgroundColor: '#007bff',
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  registerButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  loginLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  loginText: {
    color: '#666',
    fontSize: 14,
    marginRight: 4,
  },
  loginLink: {
    color: '#007bff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default RegisterScreen;