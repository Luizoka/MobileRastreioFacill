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
} from "react-native";
import {
  getCurrentPositionAsync,
  LocationObject,
  watchPositionAsync,
  LocationAccuracy,
  startLocationUpdatesAsync,
  stopLocationUpdatesAsync,
} from "expo-location";
import { removeToken, getToken } from "../utils/auth";
import { API_BASE_URL } from "@env";
import { LOCATION_TASK_NAME } from "../tasks/LocationTask";
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

  const sendCurrentLocation = async (latitude: string, longitude: string) => {
    const token = await getToken();
    if (!token) {
      console.error("Token not found");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/funcionario/enviar-localizacao-atual`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ latitude, longitude, id_empresa: selectedEmpresaId }),
      });

      if (response.status === 500) {
        const data = await response.json();
        if (data.error === "Erro ao buscar vínculo do funcionário.") {
          console.error("Error: Erro ao buscar vínculo do funcionário.");
        } else if (data.error === "Erro ao atualizar a localização atual.") {
          console.error("Error: Erro ao atualizar a localização atual.");
        } else {
          console.error("Error: Erro desconhecido ao enviar localização.");
        }
      } else if (response.status === 404) {
        const data = await response.json();
        if (data.error === "Nenhum vínculo ativo encontrado para a empresa especificada.") {
          console.error("Error: Nenhum vínculo ativo encontrado para a empresa especificada.");
        } else {
          console.error("Error: Erro desconhecido ao enviar localização.");
        }
      } else {
        const data = await response.json();
        console.log("Current location response:", data);
      }
    } catch (error) {
      console.error("Error sending current location:", error);
    }
  };

  useEffect(() => {
    const requestLocationPermissions = async () => {
      try {
        await getCurrentPositionAsync();
      } catch (error) {
        console.error("Error requesting location permissions:", error);
      }
    };
    requestLocationPermissions();
  }, []);

  useEffect(() => {
    let subscription: any = null;
    // Percorre o objeto trackingStatus para ver quais empresas estão ativas
    for (const empresaId in trackingStatus) {
      if (trackingStatus[empresaId]) {
        (async () => {
          try {
            subscription = await watchPositionAsync(
              {
                accuracy: LocationAccuracy.Highest,
                timeInterval: 10000,
                distanceInterval: 1,
              },
              (response) => {
                sendCurrentLocation(
                  response.coords.latitude.toString(),
                  response.coords.longitude.toString()
                );
              }
            );
          } catch (error) {
            console.error("Error starting watchPositionAsync:", error);
          }
        })();
      }
    }
    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [trackingStatus]);

  const handleToggleTracking = async (id_empresa: number) => {
    setSelectedEmpresaId(id_empresa);
    try {
      if (trackingStatus[id_empresa]) {
        await stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        setTrackingStatus((prev) => ({ ...prev, [id_empresa]: false }));
      } else {
        await startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: LocationAccuracy.High,
          distanceInterval: 100,
        });
        setTrackingStatus((prev) => ({ ...prev, [id_empresa]: true }));
      }
    } catch (error) {
      console.error("Error toggling tracking:", error);
    }
  };

  const renderEmpresa = React.useCallback(({ item }: { item: Empresa }) => {
    return (
      <View style={styles.empresaContainer}>
        <Text style={styles.empresaNome}>{item.name}</Text>
        <TouchableOpacity
          style={[
            styles.trackingButton,
            trackingStatus[item.id] ? styles.trackingButtonOn : styles.trackingButtonOff
          ]}
          onPress={() => handleToggleTracking(item.id)}
          activeOpacity={0.7}
        >
          <Image
            source={
              trackingStatus[item.id]
                ? require("../../assets/botao_ligado.png")
                : require("../../assets/botao_desligado.png")
            }
            style={styles.buttonImage}
          />
        </TouchableOpacity>
      </View>
    );
  }, [trackingStatus, handleToggleTracking]);

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
});

export default HallScreen;