import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Button,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Image,
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
  nome: string;
  logo: string;
  imagem: string;
  setor_atuacao: string;
  telefone_suporte: string | null;
  email_suporte: string | null;
  ativo: boolean;
}

interface Solicitacao {
  id: number;
  id_adm_solicitante: number;
  id_funcionario_destinatario: number;
  id_empresa: number;
  status: string;
  data_envio: string;
  data_resposta: string | null;
  nome?: string;
}

interface HallScreenProps {
  onLogout: () => void;
  onNavigateToLogin: () => void;
  onNavigateToMap: (id_empresa: number) => void; // Adicionado
}

const HallScreen = ({ onLogout, onNavigateToLogin, onNavigateToMap }: HallScreenProps) => {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [error, setError] = useState("");
  const [trackingStatus, setTrackingStatus] = useState<{ [key: number]: boolean }>({});
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<number | null>(null);

  const prevEmpresasRef = useRef<Empresa[]>([]);
  const prevSolicitacoesRef = useRef<Solicitacao[]>([]);

  const fetchEmpresas = async () => {
    const token = await getToken();
    if (!token) {
      setError("Token not found");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/funcionario/empresas-vinculadas`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 200) {
        const data = await response.json();
        if (JSON.stringify(data) !== JSON.stringify(prevEmpresasRef.current)) {
          setEmpresas(data);
          prevEmpresasRef.current = data;
        }
      } else if (response.status === 404) {
        const data = await response.json();
        setError(data.message || "Nenhuma empresa vinculada encontrada.");
      } else {
        const data = await response.json();
        setError(data.error || "Erro ao buscar empresas.");
      }
    } catch {
      setError("Erro ao buscar empresas.");
    }
  };

  const fetchSolicitacoes = async () => {
    const token = await getToken();
    if (!token) {
      setError("Token not found");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/funcionario/solicitacoes`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 200) {
        const data: Solicitacao[] = await response.json();

        // Carrega o nome da empresa para cada solicitação
        const solicitacoesComNome = await Promise.all(
          data.map(async (solicitacao) => {
            const empresaResponse = await fetch(
              `${API_BASE_URL}/api/empresas/${solicitacao.id_empresa}`,
              {
                method: "GET",
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );
            const empresaData = await empresaResponse.json();
            return { ...solicitacao, nome: empresaData.nome };
          })
        );
        if (JSON.stringify(solicitacoesComNome) !== JSON.stringify(prevSolicitacoesRef.current)) {
          setSolicitacoes(solicitacoesComNome);
          prevSolicitacoesRef.current = solicitacoesComNome;
        }
      } else if (response.status === 404) {
        const data = await response.json();
        console.log(data.message || "Nenhuma solicitação encontrada.");
      } else {
        const data = await response.json();
        setError(data.error || "Erro ao buscar solicitações.");
      }
    } catch {
      setError("Erro ao buscar solicitações.");
    }
  };

  useEffect(() => {
    fetchEmpresas();
  }, []);

  useEffect(() => {
    if (empresas.length > 0) {
      fetchSolicitacoes();
    }
  }, [empresas]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchEmpresas();
      fetchSolicitacoes();
    }, 60000); // 1 minuto
    return () => clearInterval(interval);
  }, [empresas]);

  const handleResponse = async (id: number, status: string) => {
    const token = await getToken();
    if (!token) {
      setError("Token not found");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/funcionario/responder-solicitacao`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id_solicitacao: id, status }),
      });

      if (response.status === 200) {
        fetchSolicitacoes();
        fetchEmpresas();
      } else {
        const data = await response.json();
        setError(
          data.error || `Erro ao ${status === "aceita" ? "aceitar" : "negar"} solicitação.`
        );
      }
    } catch {
      setError(`Erro ao ${status === "aceita" ? "aceitar" : "negar"} solicitação.`);
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

  // const addLocationToHistory = async (latitude: string, longitude: string) => {
  //   const token = await getToken();
  //   if (!token) {
  //     console.error("Token not found");
  //     return;
  //   }

  //   try {
  //     console.log("Adding location to history:", { latitude, longitude });
  //     const response = await fetch(
  //       `${API_BASE_URL}/api/funcionario/adicionar-historico-localizacao`,
  //       {
  //         method: "POST",
  //         headers: {
  //           "Content-Type": "application/json",
  //           Authorization: `Bearer ${token}`,
  //         },
  //         body: JSON.stringify({ latitude, longitude, id_empresa: selectedEmpresaId }),
  //       }
  //     );

  //     if (response.status === 500) {
  //       const data = await response.json();
  //       if (data.error === "Erro ao buscar vínculo do funcionário.") {
  //         console.error("Error: Erro ao buscar vínculo do funcionário.");
  //       } else if (data.error === "Erro ao adicionar ao histórico de localizações.") {
  //         console.error("Error: Erro ao adicionar ao histórico de localizações.");
  //       } else {
  //         console.error("Error: Erro desconhecido ao adicionar ao histórico.");
  //       }
  //     } else if (response.status === 404) {
  //       const data = await response.json();
  //       if (data.error === "Nenhum vínculo ativo encontrado para a empresa especificada.") {
  //         console.error("Error: Nenhum vínculo ativo encontrado para a empresa especificada.");
  //       } else {
  //         console.error("Error: Erro desconhecido ao adicionar ao histórico.");
  //       }
  //     } else {
  //       const data = await response.json();
  //       console.log("Location history response:", data);
  //     }
  //   } catch (error) {
  //     console.error("Error adding location to history:", error);
  //   }
  // };

  const activateApp = async () => {
    const token = await getToken();
    if (!token) {
      console.error("Token not found");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/funcionario/ativar-app`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id_empresa: selectedEmpresaId }),
      });

      if (response.status === 200) {
        const data = await response.json();
        console.log("App activation response:", data);
      } else if (response.status === 500) {
        const data = await response.json();
        console.error("Error:", data.error);
      }
    } catch (error) {
      console.error("Error activating app:", error);
    }
  };

  const deactivateApp = async () => {
    const token = await getToken();
    if (!token) {
      console.error("Token not found");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/funcionario/desativar-app`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id_empresa: selectedEmpresaId }),
      });

      if (response.status === 200) {
        const data = await response.json();
        console.log("App deactivation response:", data);
      } else if (response.status === 500) {
        const data = await response.json();
        console.error("Error:", data.error);
      }
    } catch (error) {
      console.error("Error deactivating app:", error);
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
                // addLocationToHistory(...)  // Mantenha comentado
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
        await deactivateApp();
        await stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        setTrackingStatus((prev) => ({ ...prev, [id_empresa]: false }));
      } else {
        await activateApp();
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

  const renderEmpresa = ({ item }: { item: Empresa }) => (
    <View style={styles.empresaContainer}>
      <Text style={styles.empresaNome}>{item.nome}</Text>
      <TouchableOpacity
        style={
          trackingStatus[item.id]
            ? [styles.trackingButtonOn,]
            : [styles.trackingButtonOff,]
        }
        onPress={() => handleToggleTracking(item.id)}
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

  const renderSolicitacao = ({ item }: { item: Solicitacao }) => (
    <View style={styles.solicitacaoContainer}>
      <Text style={styles.solicitacaoNome}>{item.nome}</Text>
      <View style={styles.solicitacaoButtons}>
        <TouchableOpacity
          style={styles.aceitarButton}
          onPress={() => handleResponse(item.id, "aceita")}
        >
          <Text style={styles.aceitarButtonText}>Aceitar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.negarButton}
          onPress={() => handleResponse(item.id, "recusada")}
        >
          <Text style={styles.negarButtonText}>Negar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

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
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Bem-vindo ao Rastreio Fácil</Text>
      <Text style={styles.subtitulo}>Empresas Vinculadas:</Text>
      <View style={styles.quadrado}>
        {error && !empresas.length ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <FlatList
            data={empresas}
            renderItem={renderEmpresa}
            keyExtractor={(item) => item.id.toString()}
          />
        )}
      </View>
      <Text style={styles.subtitulo}>Solicitações de acesso:</Text>
      <View style={styles.quadrado}>
        {error && !solicitacoes.length ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <FlatList
            data={solicitacoes}
            renderItem={renderSolicitacao}
            keyExtractor={(item) => item.id.toString()}
          />
        )}
      </View>
      <Button title="Sair" onPress={handleExitConfirmation} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#333",
  },
  subtitulo: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10,
    color: "#555",
  },
  quadrado: {
    width: "100%",
    padding: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    backgroundColor: "#fff",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  empresaContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  empresaNome: {
    fontSize: 16,
    color: "#333",
  },
  entrarButton: {
    backgroundColor: "#007bff",
    paddingVertical: 5,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  buttonImage: {
    width: 30,
    height: 30,
  },
  solicitacaoContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  solicitacaoNome: {
    fontSize: 16,
    color: "#333",
  },
  solicitacaoButtons: {
    flexDirection: "row",
  },
  aceitarButton: {
    backgroundColor: "#28a745",
    paddingVertical: 5,
    paddingHorizontal: 15,
    borderRadius: 5,
    marginRight: 10,
  },
  aceitarButtonText: {
    color: "#fff",
    fontSize: 14,
  },
  negarButton: {
    backgroundColor: "#dc3545",
    paddingVertical: 5,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  negarButtonText: {
    color: "#fff",
    fontSize: 14,
  },
  error: {
    color: "red",
    textAlign: "center",
  },
  trackingButtonOn: {
    paddingVertical: 5,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  trackingButtonOff: {
    paddingVertical: 5,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
});

export default HallScreen;