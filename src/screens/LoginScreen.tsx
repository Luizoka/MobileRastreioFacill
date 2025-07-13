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
  TouchableWithoutFeedback,
  Alert,
  DeviceEventEmitter
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { startBackgroundUpdate, checkBackgroundLocationAvailable } from '../tasks/LocationTask';
import { API_BASE_URL } from '@env';
import * as Device from 'expo-device';

const LoginScreen = ({ onLogin, onNavigateToRegister }: { onLogin: () => void, onNavigateToRegister: () => void }) => {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  
  // Estados para MFA
  const [showMfaScreen, setShowMfaScreen] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState('');

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

  const getDeviceInfo = () => {
    return `${Device.brand || 'Unknown'} ${Device.modelName || 'Unknown'} - ${Platform.OS} ${Platform.Version}`;
  };

  const handleLogin = async () => {
    if (!email || !senha) {
      setError('Por favor, preencha todos os campos');
      return;
    }
    
    setLoading(true);
    setError('');
    
    console.log('Tentando fazer login com:', { email, senha });
    try {
      // Obter token de dispositivo confiável se existir
      const trustedDeviceToken = await AsyncStorage.getItem('trustedDeviceToken');
      const deviceInfo = getDeviceInfo();

      const requestBody: any = {
        email,
        password: senha,
        deviceInfo
      };

      if (trustedDeviceToken) {
        requestBody.trustedDeviceToken = trustedDeviceToken;
      }

      const response = await fetch(`${API_BASE_URL}/api/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
  
      console.log('Status da resposta da API:', response.status);
      
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
  
      if (response.status === 200) {
        console.log('Resposta de login:', data);
        
        // Verificar se MFA é necessário
        if (data.mfaRequired) {
          setUserId(data.userId);
          setShowMfaScreen(true);
          setLoading(false);
          return;
        }
        
        // Login direto com dispositivo confiável
        const { token, refreshToken, trustedDeviceToken: newTrustedToken, expiresIn } = data;
        
        // Salvar tokens
        await AsyncStorage.setItem('token', token);
        if (refreshToken) {
          await AsyncStorage.setItem('refreshToken', refreshToken);
        }
        if (newTrustedToken) {
          await AsyncStorage.setItem('trustedDeviceToken', newTrustedToken);
        }
        
        // Salvar informações de expiração
        const expirationTime = Date.now() + (expiresIn * 1000);
        await AsyncStorage.setItem('tokenExpiration', expirationTime.toString());
        
        await handleSuccessfulLogin();
      } else if (response.status === 403) {
        console.error('Erro de login: Usuário inativo');
        setError(`Usuário não ativado. Verifique sua caixa de entrada em ${email} para ativar sua conta.`);
      } else if (response.status === 401) {
        console.error('Erro de login: Credenciais inválidas');
        setError('Falha no login. Verifique suas credenciais.');
      } else if (response.status === 500) {
        console.error('Erro de login: Erro ao realizar login');
        setError('Erro no servidor. Tente novamente mais tarde.');
      } else {
        console.error('Erro de login:', response.statusText);
        setError('Falha no login. Tente novamente.');
      }
    } catch (err: any) {
     console.error('Erro de login (detalhado):', {
      message: err.message,
      name: err.name,
      stack: err.stack,
      cause: err.cause,
      toString: err.toString(),
      ...(err instanceof TypeError && { isTypeError: true })
    });
    setError(`Erro de conexão: ${err.message || 'verifique a internet ou o endereço da API'}`);

    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerification = async () => {
    if (!mfaCode || !userId) {
      setMfaError('Por favor, insira o código MFA');
      return;
    }
    
    setMfaLoading(true);
    setMfaError('');
    
    try {
      const deviceInfo = getDeviceInfo();
      
      // Preparar body da requisição MFA
      const mfaBody = {
        userId,
        code: mfaCode,
        deviceInfo
      };
      
      console.log('Body da requisição MFA:', JSON.stringify(mfaBody, null, 2));
      
      // Fazer verificação MFA com token temporário
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-mfa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mfaBody),
      });
      
      console.log('Status da resposta MFA:', response.status);
      console.log('Headers da resposta MFA:', response.headers);
      
      const responseText = await response.text();
      console.log('Resposta MFA bruta:', responseText);
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Erro ao analisar resposta JSON MFA:', e);
        setMfaError('Erro ao processar resposta do servidor');
        setMfaLoading(false);
        return;
      }
      
      if (response.status === 200) {
        console.log('MFA verificado com sucesso:', data);
        
        const { token, refreshToken, trustedDeviceToken, expiresIn } = data;
        
        // Salvar tokens
        await AsyncStorage.setItem('token', token);
        if (refreshToken) {
          await AsyncStorage.setItem('refreshToken', refreshToken);
        }
        if (trustedDeviceToken) {
          await AsyncStorage.setItem('trustedDeviceToken', trustedDeviceToken);
        }
        
        // Salvar informações de expiração
        const expirationTime = Date.now() + (expiresIn * 1000);
        await AsyncStorage.setItem('tokenExpiration', expirationTime.toString());
        
        await handleSuccessfulLogin();
      } else if (response.status === 401) {
        console.error('Erro MFA: Código inválido ou expirado');
        setMfaError('Código MFA inválido ou expirado. Verifique seu email.');
      } else if (response.status === 404) {
        console.error('Erro MFA: Usuário não encontrado');
        setMfaError('Usuário não encontrado. Tente fazer login novamente.');
      } else if (response.status === 500) {
        console.error('Erro MFA: Erro interno do servidor');
        setMfaError('Erro no servidor. Tente novamente mais tarde.');
      } else {
        console.error('Erro MFA:', response.statusText);
        setMfaError('Falha na verificação. Tente novamente.');
      }
    } catch (err: any) {
      console.error('Erro de verificação MFA:', err);
      setMfaError(`Erro de conexão: ${err.message || 'verifique a internet'}`);
    } finally {
      setMfaLoading(false);
    }
  };

  const handleSuccessfulLogin = async () => {
    // Verificar se o usuário permite rastreamento em segundo plano
    const hasBackgroundPermission = await checkBackgroundLocationAvailable();
    
    if (hasBackgroundPermission) {
      // Se tiver permissão, perguntar se deseja ativar agora
      Alert.alert(
        "Rastreamento em Segundo Plano",
        "Deseja ativar o rastreamento em segundo plano? Isso permite que o aplicativo envie sua localização mesmo quando estiver fechado.",
        [
          { 
            text: "Não Agora", 
            style: "cancel",
            onPress: () => onLogin()
          },
          { 
            text: "Ativar", 
            onPress: async () => {
              await startBackgroundUpdate();
              onLogin();
            }
          }
        ]
      );
    } else {
      // Se não tiver permissão, apenas continuar
      onLogin();
    }
  };

  const handleBackToLogin = () => {
    setShowMfaScreen(false);
    setUserId(null);
    setMfaCode('');
    setMfaError('');
  };

  const resendMfaCode = async () => {
    if (!email || !senha) {
      setMfaError('Informações de login não encontradas. Volte e faça login novamente.');
      return;
    }
    
    setMfaLoading(true);
    setMfaError('');
    
    try {
      const deviceInfo = getDeviceInfo();
      
      const response = await fetch(`${API_BASE_URL}/api/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password: senha,
          deviceInfo
        }),
      });
      
      const data = await response.json();
      
      if (response.status === 200 && data.mfaRequired) {
        setUserId(data.userId);
        Alert.alert(
          "Código Reenviado",
          "Um novo código MFA foi enviado para seu email."
        );
      } else {
        setMfaError('Erro ao reenviar código. Tente novamente.');
      }
    } catch (err: any) {
      console.error('Erro ao reenviar código MFA:', err);
      setMfaError('Erro de conexão ao reenviar código.');
    } finally {
      setMfaLoading(false);
    }
  };

  if (showMfaScreen) {
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
                    {renderMfaContent()}
                  </ScrollView>
                </KeyboardAvoidingView>
              ) : (
                <ScrollView 
                  contentContainerStyle={styles.scrollContainer}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                >
                  {renderMfaContent()}
                </ScrollView>
              )}
            </ImageBackground>
          </SafeAreaView>
        </TouchableWithoutFeedback>
      </>
    );
  }

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

  function renderMfaContent() {
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
          <Text style={styles.mfaTitle}>Verificação de Segurança</Text>
          <Text style={styles.mfaSubtitle}>
            Enviamos um código de verificação para {email}
          </Text>
          
          <TextInput
            style={styles.input}
            placeholder="Código MFA"
            value={mfaCode}
            onChangeText={setMfaCode}
            placeholderTextColor="#8BA6C1"
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />
          
          {mfaError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{mfaError}</Text>
            </View>
          ) : null}
          
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={handleMfaVerification}
            disabled={mfaLoading}
            activeOpacity={0.8}
          >
            {mfaLoading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.loginButtonText}>Verificar</Text>
            )}
          </TouchableOpacity>
          
          <View style={styles.mfaActionsContainer}>
            <TouchableOpacity onPress={resendMfaCode} disabled={mfaLoading}>
              <Text style={styles.mfaActionLink}>Reenviar Código</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={handleBackToLogin} disabled={mfaLoading}>
              <Text style={styles.mfaActionLink}>Voltar ao Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  }

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
          
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.loginButtonText}>Entrar</Text>
            )}
          </TouchableOpacity>
          
          <View style={styles.registerLinkContainer}>
            <Text style={styles.registerText}>Não tem uma conta?</Text>
            <TouchableOpacity onPress={onNavigateToRegister}>
              <Text style={styles.registerLink}>Cadastre-se</Text>
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
    marginBottom: 40,
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
  loginButton: {
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
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  registerLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  registerText: {
    color: '#666',
    fontSize: 14,
    marginRight: 4,
  },
  registerLink: {
    color: '#007bff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Estilos para MFA
  mfaTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  mfaSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  mfaActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  mfaActionLink: {
    color: '#007bff',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default LoginScreen;