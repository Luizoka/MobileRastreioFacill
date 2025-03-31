import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  Button,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Image,
  RefreshControl,
  Animated,
  ActivityIndicator,
  Platform,
  StatusBar,
  ScrollView,
  AppState,
  AppStateStatus,
} from "react-native";
import {
  getCurrentPositionAsync,
  LocationObject,
  watchPositionAsync,
  LocationAccuracy,
  startLocationUpdatesAsync,
  stopLocationUpdatesAsync,
  hasStartedLocationUpdatesAsync,
  requestBackgroundPermissionsAsync,
  requestForegroundPermissionsAsync,
} from "expo-location";
import { removeToken, getToken } from "../utils/auth";
import { API_BASE_URL } from "@env";
import { 
  LOCATION_TASK_NAME, 
  startBackgroundUpdate, 
  stopBackgroundUpdate, 
  sendLocationToApi,
  isBackgroundTrackingActive,
  checkBackgroundLocationAvailable
} from "../tasks/LocationTask";
import { Alert } from "react-native";

interface Empresa {
  id: number;
  name: string;
  logo?: string;
  imagem?: string;
  setor_atuacao?: string;
  telefone_suporte?: string | null;
  email_suporte?: string | null;
  ativo?: boolean;
}

interface Solicitacao {
  id: number;
  request_type: string;
  requester_id: number;
  recipient_id: number;
  company_id: number;
  status: string;
  request_date: string;
  response_date: string | null;
  companyName?: string;
}

interface HallScreenProps {
  onLogout: () => void;
  onNavigateToLogin: () => void;
  onNavigateToMap: (id_empresa: number) => void; // Adicionado
}

const HallScreen = ({ onLogout, onNavigateToLogin, onNavigateToMap }: HallScreenProps) => {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [empresasError, setEmpresasError] = useState("");
  const [solicitacoesError, setSolicitacoesError] = useState("");
  const [trackingStatus, setTrackingStatus] = useState<{ [key: number]: boolean }>({});
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<number | null>(null);
  const [solicitacoesCarregadas, setSolicitacoesCarregadas] = useState(false);
  
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  const prevEmpresasRef = useRef<Empresa[]>([]);
  const prevSolicitacoesRef = useRef<Solicitacao[]>([]);

  const [locationPermission, setLocationPermission] = useState(false);
  const [backgroundPermission, setBackgroundPermission] = useState(false);
  const [activeCompanies, setActiveCompanies] = useState<number[]>([]);
  const [foregroundLocationActive, setForegroundLocationActive] = useState(false);
  
  const appState = useRef(AppState.currentState);
  const foregroundLocationInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    
    try {
      await fetchEmpresas();
      if (empresas.length > 0) {
        await fetchSolicitacoes();
      }
    } finally {
      setRefreshing(false);
    }
  }, [empresas]);

  const fetchEmpresas = async () => {
    const token = await getToken();
    if (!token) {
      setEmpresasError("Token não encontrado");
      return;
    }

    try {
      const tokenParts = token.split('.');
      const payload = JSON.parse(atob(tokenParts[1]));
      const userId = payload.id;

      const response = await fetch(`${API_BASE_URL}/api/user-role-companies/user/${userId}/role?role=employee`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 200) {
        setEmpresasError("");
        const data = await response.json();
        if (JSON.stringify(data) !== JSON.stringify(prevEmpresasRef.current)) {
          setEmpresas(data);
          prevEmpresasRef.current = data;
        }
      } else if (response.status === 400) {
        setEmpresasError("Role inválida");
      } else if (response.status === 500) {
        setEmpresasError("Erro ao buscar empresas por usuário e role");
      } else {
        const data = await response.json();
        setEmpresasError(data.error || "Erro ao buscar empresas");
      }
    } catch (error) {
      console.error("Erro ao buscar empresas:", error);
      setEmpresasError("Erro ao buscar empresas");
    }
  };

  const fetchSolicitacoes = async () => {
    setSolicitacoesCarregadas(false);
    
    const token = await getToken();
    if (!token) {
      setSolicitacoesError("Token não encontrado");
      setSolicitacoesCarregadas(true);
      return;
    }

    try {
      setSolicitacoesError("");
      
      const tokenParts = token.split('.');
      const payload = JSON.parse(atob(tokenParts[1]));
      const userId = payload.id;

      console.log("Buscando solicitações para o usuário:", userId);

      const response = await fetch(`${API_BASE_URL}/api/requests/recipient/${userId}?type=employee_request`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const responseText = await response.text();
      console.log("Resposta bruta:", responseText);
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error("Erro ao parsear JSON:", e);
        setSolicitacoesError("Erro ao processar resposta do servidor");
        setSolicitacoesCarregadas(true);
        return;
      }

      if (response.status === 200) {
        if (Array.isArray(data)) {
          console.log("Solicitações encontradas:", data.length);
          
          if (data.length > 0) {
            const solicitacoesComNome = await Promise.all(
              data.map(async (solicitacao) => {
                try {
                  const empresaResponse = await fetch(
                    `${API_BASE_URL}/api/companies/${solicitacao.company_id}`,
                    {
                      method: "GET",
                      headers: {
                        Authorization: `Bearer ${token}`,
                      },
                    }
                  );
                  
                  if (empresaResponse.status === 200) {
                    const empresaData = await empresaResponse.json();
                    return { ...solicitacao, companyName: empresaData.name };
                  } else {
                    return { ...solicitacao, companyName: "Empresa desconhecida" };
                  }
                } catch (error) {
                  console.error("Erro ao buscar empresa:", error);
                  return { ...solicitacao, companyName: "Empresa desconhecida" };
                }
              })
            );
            
            setSolicitacoes(solicitacoesComNome);
          } else {
            console.log("Array vazio de solicitações");
            setSolicitacoes([]);
          }
        } else if (data && data.message && 
                (data.message.includes("Nenhuma solicitação") || 
                 data.message.includes("nenhuma solicitação"))) {
          console.log("Mensagem do servidor:", data.message);
          setSolicitacoes([]);
        } else {
          console.log("Resposta não esperada do tipo 200:", data);
          setSolicitacoes([]);
        }
        
        setSolicitacoesError("");
      } else if (response.status === 404 && data && data.message === "Nenhuma solicitação foi encontrada") {
        console.log("404: Nenhuma solicitação encontrada");
        setSolicitacoes([]);
        setSolicitacoesError("");
      } else if (response.status === 400 && data && data.message === "Tipo de solicitação inválido") {
        console.log("400: Tipo de solicitação inválido");
        setSolicitacoesError("Tipo de solicitação inválido");
      } else if (response.status === 500 && data && data.message === "Erro ao buscar solicitações") {
        console.log("500: Erro ao buscar solicitações");
        setSolicitacoesError("Erro ao buscar solicitações");
      } else {
        console.log(`Erro não específico (${response.status}):`, data);
        setSolicitacoesError(data.message || "Erro ao buscar solicitações");
      }
    } catch (error) {
      console.error("Exceção ao buscar solicitações:", error);
      setSolicitacoesError("Erro ao buscar solicitações. Verifique sua conexão.");
    } finally {
      setSolicitacoesCarregadas(true);
    }
  };

  useEffect(() => {
    fetchEmpresas();
  }, []);

  useEffect(() => {
    if (empresas.length > 0) {
      fetchSolicitacoes();
    } else {
      setSolicitacoes([]);
      setSolicitacoesError("");
    }
  }, [empresas]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchEmpresas();
      if (empresas.length > 0) {
        fetchSolicitacoes();
      }
    }, 60000); // 1 minuto
    return () => clearInterval(interval);
  }, [empresas]);

  const handleResponse = async (id: number, status: string) => {
    const token = await getToken();
    if (!token) {
      setSolicitacoesError("Token não encontrado");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/requests/respond/${id}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      if (response.status === 200) {
        const data = await response.json();
        console.log("Solicitação respondida com sucesso:", data);
        // Atualiza as listas após responder a solicitação
        fetchSolicitacoes();
        fetchEmpresas();
        
        // Exibe uma mensagem de sucesso ao usuário
        Alert.alert(
          "Sucesso", 
          `Solicitação ${status === "accepted" ? "aceita" : "recusada"} com sucesso!`,
          [{ text: "OK" }]
        );
      } else if (response.status === 404) {
        const data = await response.json();
        console.error("Erro 404:", data.error);
        setSolicitacoesError(data.error || "Solicitação não encontrada ou tipo inválido");
      } else if (response.status === 400) {
        setSolicitacoesError("Erro de validação na resposta");
      } else if (response.status === 500) {
        setSolicitacoesError("Erro ao responder solicitação. Tente novamente.");
      } else {
        const data = await response.json();
        setSolicitacoesError(
          data.error || `Erro ao ${status === "accepted" ? "aceitar" : "recusar"} solicitação.`
        );
      }
    } catch (error) {
      console.error("Erro ao responder solicitação:", error);
      setSolicitacoesError(`Erro ao ${status === "accepted" ? "aceitar" : "recusar"} solicitação. Verifique sua conexão.`);
    }
  };

  // Verificar permissões de localização ao iniciar
  useEffect(() => {
    console.log("🔍 Verificando permissões de localização...");
    const checkPermissions = async () => {
      const { status: foregroundStatus } = await requestForegroundPermissionsAsync();
      console.log("📱 Status da permissão de localização em primeiro plano:", foregroundStatus);
      setLocationPermission(foregroundStatus === 'granted');
      
      const { status: backgroundStatus } = await requestBackgroundPermissionsAsync();
      console.log("📱 Status da permissão de localização em segundo plano:", backgroundStatus);
      setBackgroundPermission(backgroundStatus === 'granted');
    };
    
    checkPermissions();
  }, []);

  // Monitorar mudanças no estado do aplicativo (foreground/background)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
      if (foregroundLocationInterval.current) {
        clearInterval(foregroundLocationInterval.current);
        foregroundLocationInterval.current = null;
      }
    };
  }, [trackingStatus, activeCompanies]);

  // Função para lidar com mudanças no estado do aplicativo
  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
      // App está indo para o background
      if (activeCompanies.length > 0 && !isBackgroundTrackingActive) {
        // Há empresas com rastreamento ativo, mas o background tracking não está ativo
        Alert.alert(
          "Rastreamento em segundo plano",
          "O aplicativo continuará enviando sua localização apenas enquanto estiver aberto. Para manter o rastreamento mesmo com o app fechado, ative o rastreamento em segundo plano.",
          [
            { text: "Ignorar", style: "cancel" },
            { 
              text: "Ativar", 
              onPress: async () => {
                const success = await startBackgroundUpdate();
                if (success) {
                  Alert.alert(
                    "Sucesso",
                    "Rastreamento em segundo plano ativado com sucesso!"
                  );
                } else {
                  Alert.alert(
                    "Erro",
                    "Não foi possível ativar o rastreamento em segundo plano. Verifique as permissões do aplicativo."
                  );
                }
              }
            }
          ]
        );
      }
    } else if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      // App está voltando para o primeiro plano
      if (activeCompanies.length > 0) {
        // Reiniciar o rastreamento em primeiro plano se necessário
        startForegroundLocationUpdates();
      }
    }
    
    appState.current = nextAppState;
  };

  // Função para iniciar o rastreamento em primeiro plano
  const startForegroundLocationUpdates = () => {
    console.log("🚀 Iniciando rastreamento em primeiro plano");
    
    if (foregroundLocationInterval.current) {
      console.log("🧹 Limpando intervalo anterior");
      clearInterval(foregroundLocationInterval.current);
    }
    
    // Imediatamente obter e enviar a localização atual
    console.log("📍 Obtendo posição inicial...");
    getCurrentPositionAndSend();
    
    console.log("⏱️ Configurando intervalo de 30 segundos para atualização");
    // Configurar intervalo para obter e enviar a localização periodicamente
    foregroundLocationInterval.current = setInterval(() => {
      console.log("⏱️ Executando atualização agendada");
      getCurrentPositionAndSend();
    }, 30000); // A cada 30 segundos
    
    setForegroundLocationActive(true);
    console.log("✅ Rastreamento em primeiro plano ativado com sucesso");
    
    // Adicionar um alerta explícito sobre o rastreamento ativo
    Alert.alert(
      "Rastreamento Ativado",
      "O rastreamento de localização está ativo enquanto o aplicativo estiver aberto. Sua localização será enviada a cada 30 segundos.",
      [{ text: "OK" }]
    );
  };

  // Função para parar o rastreamento em primeiro plano
  const stopForegroundLocationUpdates = () => {
    if (foregroundLocationInterval.current) {
      clearInterval(foregroundLocationInterval.current);
      foregroundLocationInterval.current = null;
    }
    setForegroundLocationActive(false);
  };

  // Função para obter a posição atual e enviar para a API
  const getCurrentPositionAndSend = async () => {
    console.log("🔍 Iniciando getCurrentPositionAndSend");
    console.log("🔍 Permissão de localização:", locationPermission);
    console.log("🔍 Empresas ativas:", activeCompanies);
    
    if (!locationPermission || activeCompanies.length === 0) {
      console.log("⚠️ Não foi possível obter localização: Sem permissão ou sem empresas ativas");
      return;
    }
    
    try {
      console.log("📍 Solicitando posição atual...");
      const position = await getCurrentPositionAsync({
        accuracy: LocationAccuracy.High
      });
      
      console.log("📍 Posição obtida:", position.coords);
      const { latitude, longitude } = position.coords;
      
      console.log("📍 Enviando posição para empresas:", activeCompanies);
      
      // Aqui estamos utilizando diretamente os valores numéricos
      const result = await sendLocationToApi(
        latitude, 
        longitude, 
        activeCompanies
      );
      
      console.log("📍 Resultado do envio:", result);
      
      if (result.success) {
        console.log("✅ Localização enviada com sucesso!");
        // Alert.alert("Sucesso", "Localização enviada com sucesso!");
      } else {
        console.error("❌ Falha ao enviar localização:", result.error);
        Alert.alert(
          "Erro ao Enviar Localização",
          result.error || "Não foi possível enviar sua localização. Tente novamente."
        );
        
        if (result.status === 404) {
          Alert.alert(
            "Erro",
            "Usuário não encontrado. Por favor, faça login novamente.",
            [
              {
                text: "OK",
                onPress: async () => {
                  await removeToken();
                  onLogout();
                  onNavigateToLogin();
                },
              },
            ]
          );
        }
      }
    } catch (error) {
      console.error("❌ Erro ao obter posição atual:", error);
      
      // Adicionando mais detalhes sobre o erro
      if (error instanceof Error) {
        console.error("❌ Detalhes do erro:", error.message);
        console.error("❌ Stack trace:", error.stack);
      }
      
      Alert.alert(
        "Erro de Localização",
        "Não foi possível obter sua localização atual. Verifique se o GPS está ativado e se o aplicativo tem permissão para acessá-lo.",
        [{ text: "OK" }]
      );
    }
  };

  // Modificação da função handleToggleTracking
  const handleToggleTracking = async (id_empresa: number) => {
    console.log("🔄 Alternando rastreamento para empresa:", id_empresa);
    console.log("🔄 Estado atual:", trackingStatus[id_empresa] ? "ATIVO" : "INATIVO");
    
    try {
      if (trackingStatus[id_empresa]) {
        console.log("🛑 Desativando rastreamento...");
        
        // Desativar rastreamento para esta empresa
        setActiveCompanies(prev => {
          const updated = prev.filter(id => id !== id_empresa);
          console.log("🛑 Empresas ativas atualizadas:", updated);
          return updated;
        });
        
        setTrackingStatus(prev => {
          const updated = { ...prev, [id_empresa]: false };
          console.log("🛑 Status de rastreamento atualizado:", updated);
          return updated;
        });
        
        // Se não houver mais empresas ativas, parar o rastreamento em primeiro plano
        const updatedActiveCompanies = activeCompanies.filter(id => id !== id_empresa);
        if (updatedActiveCompanies.length === 0) {
          console.log("🛑 Nenhuma empresa ativa restante, parando rastreamento em primeiro plano");
          stopForegroundLocationUpdates();
          if (isBackgroundTrackingActive) {
            console.log("🛑 Parando rastreamento em segundo plano também");
            await stopBackgroundUpdate();
          }
        }
        
        // Adicionando alerta para confirmar desativação
        Alert.alert(
          "Rastreamento Desativado",
          "O rastreamento de localização para esta empresa foi desativado."
        );
      } else {
        console.log("▶️ Ativando rastreamento...");
        
        // Verificar permissão de localização em primeiro plano
        if (!locationPermission) {
          console.log("📱 Solicitando permissão de localização...");
          const { status } = await requestForegroundPermissionsAsync();
          console.log("📱 Status da permissão:", status);
          
          if (status !== 'granted') {
            console.log("❌ Permissão negada");
            Alert.alert(
              "Permissão Necessária",
              "O aplicativo precisa de permissão para acessar sua localização.",
              [{ text: "OK" }]
            );
            return;
          }
          setLocationPermission(true);
        }
        
        // Ativar rastreamento para esta empresa
        setSelectedEmpresaId(id_empresa);
        
        setActiveCompanies(prev => {
          const updated = [...prev, id_empresa];
          console.log("▶️ Empresas ativas atualizadas:", updated);
          return updated;
        });
        
        setTrackingStatus(prev => {
          const updated = { ...prev, [id_empresa]: true };
          console.log("▶️ Status de rastreamento atualizado:", updated);
          return updated;
        });
        
        // Iniciar rastreamento em primeiro plano se ainda não estiver ativo
        if (!foregroundLocationActive) {
          console.log("▶️ Iniciando rastreamento em primeiro plano");
          startForegroundLocationUpdates();
        } else {
          console.log("▶️ Rastreamento em primeiro plano já está ativo");
          // Forçar um envio imediato de localização
          getCurrentPositionAndSend();
        }
        
        // Perguntar sobre ativar rastreamento em segundo plano
        if (!backgroundPermission) {
          Alert.alert(
            "Rastreamento em Segundo Plano",
            "Deseja ativar o rastreamento em segundo plano? Isso permite que o aplicativo continue rastreando sua localização mesmo quando estiver fechado.",
            [
              { 
                text: "Não", 
                style: "cancel",
              },
              { 
                text: "Sim", 
                onPress: async () => {
                  const success = await startBackgroundUpdate();
                  if (!success) {
                    Alert.alert(
                      "Aviso",
                      "Não foi possível ativar o rastreamento em segundo plano. O rastreamento funcionará apenas com o aplicativo aberto."
                    );
                  } else {
                    setBackgroundPermission(true);
                  }
                }
              }
            ]
          );
        } else if (!isBackgroundTrackingActive) {
          // Já tem permissão, mas o rastreamento em segundo plano não está ativo
          Alert.alert(
            "Rastreamento em Segundo Plano",
            "Deseja ativar o rastreamento em segundo plano? Isso permite que o aplicativo continue rastreando sua localização mesmo quando estiver fechado.",
            [
              { 
                text: "Não", 
                style: "cancel",
              },
              { 
                text: "Sim", 
                onPress: async () => {
                  await startBackgroundUpdate();
                }
              }
            ]
          );
        }
      }
    } catch (error) {
      console.error("❌ Erro ao alternar rastreamento:", error);
      
      // Mais detalhes sobre o erro
      if (error instanceof Error) {
        console.error("❌ Detalhes do erro:", error.message);
        console.error("❌ Stack trace:", error.stack);
      }
      
      Alert.alert(
        "Erro",
        "Não foi possível alternar o rastreamento. Tente novamente."
      );
    }
  };

  const renderEmpresa = React.useCallback(({ item }: { item: Empresa }) => {
    const isTracking = trackingStatus[item.id] || false;
    const isBackgroundTracking = isTracking && isBackgroundTrackingActive;
    
    console.log(`🏢 Empresa ${item.name} (${item.id}): ${isTracking ? "Rastreamento ATIVO" : "Rastreamento INATIVO"}`);
    
    return (
      <View style={styles.empresaContainer}>
        <View style={styles.empresaInfo}>
          <Text style={styles.empresaNome}>{item.name}</Text>
          {isTracking && (
            <Text style={[
              styles.trackingModeText, 
              isBackgroundTracking ? styles.backgroundModeText : styles.foregroundModeText
            ]}>
              {isBackgroundTracking ? "Rastreamento contínuo" : "Rastreamento com app aberto"}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.trackingButton,
            isTracking ? styles.trackingButtonOn : styles.trackingButtonOff
          ]}
          onPress={() => handleToggleTracking(item.id)}
          activeOpacity={0.7}
        >
          <Image
            source={
              isTracking
                ? require("../../assets/botao_ligado.png")
                : require("../../assets/botao_desligado.png")
            }
            style={styles.buttonImage}
          />
        </TouchableOpacity>
      </View>
    );
  }, [trackingStatus, handleToggleTracking, isBackgroundTrackingActive]);

  const renderSolicitacao = React.useCallback(({ item }: { item: Solicitacao }) => {
    return (
      <View style={styles.solicitacaoContainer}>
        <Text style={styles.solicitacaoNome}>{item.companyName}</Text>
        <View style={styles.solicitacaoButtons}>
          <TouchableOpacity
            style={styles.aceitarButton}
            onPress={() => handleResponse(item.id, "accepted")}
            activeOpacity={0.8}
          >
            <Text style={styles.aceitarButtonText}>Aceitar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.negarButton}
            onPress={() => handleResponse(item.id, "declined")}
            activeOpacity={0.8}
          >
            <Text style={styles.negarButtonText}>Negar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [handleResponse]);

  const handleExitConfirmation = () => {
    Alert.alert(
      "Confirmar saída",
      "Deseja interromper o envio de localização e voltar para a tela de login?",
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Sim",
          onPress: async () => {
            await removeToken();
            onLogout();
            onNavigateToLogin();
          },
        },
      ]
    );
  };

  // Adicione este useEffect após o existente que verifica permissões
  useEffect(() => {
    // Verificar status do rastreamento ao iniciar
    const checkTrackingStatus = async () => {
      console.log("Verificando status do rastreamento...");
      
      try {
        // Obter as empresas que estavam sendo rastreadas antes
        const currentActiveCompanies = activeCompanies;
        
        if (currentActiveCompanies.length > 0) {
          console.log("Empresas ativas para rastreamento:", currentActiveCompanies);
          
          // Se havia rastreamento ativo, reiniciar
          startForegroundLocationUpdates();
          console.log("Rastreamento em primeiro plano reiniciado");
        } else {
          console.log("Nenhuma empresa com rastreamento ativo");
        }
      } catch (error) {
        console.error("Erro ao verificar status do rastreamento:", error);
      }
    };
    
    checkTrackingStatus();
  }, []);

  return (
    <>
      <StatusBar backgroundColor="#1a73e8" barStyle="light-content" />
      <SafeAreaView style={styles.safeAreaTop} />
      <SafeAreaView style={styles.safeAreaBottom}>
        <Animated.View 
          style={[
            styles.container, 
            { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
          ]}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#1a73e8']}
                tintColor="#1a73e8"
              />
            }
          >
            <View style={styles.header}>
              <Text style={styles.title}>Rastreio Fácill</Text>
            </View>
            
            <Text style={styles.subtitulo}>Empresas Vinculadas</Text>
            <View style={styles.quadrado}>
              {empresasError ? (
                <Text style={styles.error}>{empresasError}</Text>
              ) : empresas.length === 0 ? (
                <Text style={styles.emptyMessage}>
                  Você ainda não está vinculado a nenhuma empresa. 
                  Solicitações de vínculo aparecerão abaixo quando disponíveis.
                </Text>
              ) : (
                <FlatList
                  data={empresas}
                  renderItem={renderEmpresa}
                  keyExtractor={(item) => item.id.toString()}
                  scrollEnabled={false}
                  nestedScrollEnabled={false}
                />
              )}
            </View>
            
            <Text style={styles.subtitulo}>Solicitações de acesso</Text>
            <View style={styles.quadrado}>
              {!solicitacoesCarregadas ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#1a73e8" />
                  <Text style={styles.loadingText}>Carregando solicitações...</Text>
                </View>
              ) : solicitacoesError ? (
                <Text style={styles.error}>{solicitacoesError}</Text>
              ) : solicitacoes.length === 0 ? (
                <Text style={styles.emptyMessage}>
                  Não há solicitações de acesso pendentes no momento.
                </Text>
              ) : (
                <FlatList
                  data={solicitacoes}
                  renderItem={renderSolicitacao}
                  keyExtractor={(item) => item.id.toString()}
                  scrollEnabled={false}
                  nestedScrollEnabled={false}
                />
              )}
            </View>
            
            <TouchableOpacity 
              style={styles.logoutButton}
              onPress={handleExitConfirmation}
              activeOpacity={0.8}
            >
              <Text style={styles.logoutButtonText}>Sair</Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  safeAreaTop: {
    flex: 0,
    backgroundColor: '#1a73e8',
  },
  safeAreaBottom: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  scrollContainer: {
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 16 : 8,
    paddingBottom: 32,
  },
  header: {
    paddingVertical: 24,
    marginTop: 8,
    marginBottom: 24,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a73e8',
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    marginHorizontal: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#ffffff",
    textAlign: 'center',
  },
  subtitulo: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    marginTop: 20,
    color: "#333",
    paddingLeft: 5,
  },
  quadrado: {
    width: "100%",
    minHeight: 100,
    padding: 15,
    borderRadius: 16,
    backgroundColor: "#fff",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  empresaContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  empresaInfo: {
    flex: 1,
  },
  empresaNome: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  trackingButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 25,
  },
  trackingButtonOn: {
    backgroundColor: 'rgba(40, 167, 69, 0.1)',
  },
  trackingButtonOff: {
    backgroundColor: 'rgba(220, 53, 69, 0.05)',
  },
  buttonImage: {
    width: 35,
    height: 35,
  },
  solicitacaoContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  solicitacaoNome: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    flex: 1,
  },
  solicitacaoButtons: {
    flexDirection: "row",
  },
  aceitarButton: {
    backgroundColor: "#28a745",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginRight: 10,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  aceitarButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  negarButton: {
    backgroundColor: "#dc3545",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  negarButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  error: {
    color: "#dc3545",
    textAlign: "center",
    padding: 15,
    backgroundColor: "rgba(220, 53, 69, 0.1)",
    borderRadius: 8,
    marginVertical: 5,
  },
  emptyMessage: {
    color: "#666",
    textAlign: "center",
    padding: 20,
    fontSize: 15,
    fontStyle: "italic",
    backgroundColor: "rgba(0, 0, 0, 0.02)",
    borderRadius: 8,
    marginVertical: 5,
  },
  loadingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 16,
    color: "#666",
  },
  logoutButton: {
    backgroundColor: "#f44336",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 20,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  trackingModeText: {
    fontSize: 12,
    marginTop: 4,
  },
  foregroundModeText: {
    color: "#ff9800",
    fontStyle: "italic",
  },
  backgroundModeText: {
    color: "#28a745",
    fontWeight: "500",
  },
});

export default HallScreen;