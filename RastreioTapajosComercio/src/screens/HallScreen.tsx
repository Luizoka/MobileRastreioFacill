import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Button,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { removeToken, getToken } from "../utils/auth";
import { API_BASE_URL } from "@env";

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
  nome?: string; // Adicionando o campo nome opcionalmente
}

const HallScreen = ({
  onNavigateToMap,
  onLogout,
  onNavigateToLogin,
}: {
  onNavigateToMap: (id_empresa: number) => void;
  onLogout: () => void;
  onNavigateToLogin: () => void;
}) => {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [error, setError] = useState("");

  const prevEmpresasRef = useRef<Empresa[]>([]);
  const prevSolicitacoesRef = useRef<Solicitacao[]>([]);

  const handleLogout = async () => {
    await removeToken();
    onLogout();
    onNavigateToLogin();
  };

  const fetchEmpresas = async () => {
    const token = await getToken();
    if (!token) {
      setError("Token not found");
      return;
    }
  
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/funcionario/empresas-vinculadas`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
  
      if (response.status === 200) {
        const data = await response.json();
        console.log("Empresas:", data);
  
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
    } catch (error) {
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
      const response = await fetch(
        `${API_BASE_URL}/api/funcionario/solicitacoes`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 200) {
        const data: Solicitacao[] = await response.json();
        console.log("Solicitações:", data);

        // Obter o nome da empresa para cada solicitação
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

        // Verificar se os dados mudaram
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
    } catch (error) {
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
      console.log("Atualizou a tela");
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
      const response = await fetch(
        `${API_BASE_URL}/api/funcionario/responder-solicitacao`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id_solicitacao: id,
            status: status,
          }),
        }
      );

      if (response.status === 200) {
        // Atualizar a lista de solicitações após responder
        fetchSolicitacoes();
        fetchEmpresas();
      } else {
        const data = await response.json();
        setError(data.error || `Erro ao ${status === "aceita" ? "aceitar" : "negar"} solicitação.`);
      }
    } catch (error) {
      setError(`Erro ao ${status === "aceita" ? "aceitar" : "negar"} solicitação.`);
    }
  };

  const renderEmpresa = ({ item }: { item: Empresa }) => (
    <View style={styles.empresaContainer}>
      <Text style={styles.empresaNome}>{item.nome}</Text>
      <TouchableOpacity
        style={styles.entrarButton}
        onPress={() => onNavigateToMap(item.id)}
      >
        <Text style={styles.entrarButtonText}>Entrar</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSolicitacao = ({ item }: { item: Solicitacao }) => (
    <View style={styles.empresaContainer}>
      <Text style={styles.empresaNome}>{item.nome}</Text>
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
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Bem-vindo ao Hall</Text>
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
      <Button title="Logout" onPress={handleLogout} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  title: {
    fontSize: 24,
    marginBottom: 10,
    marginTop: 20,
  },
  subtitulo: {
    fontSize: 18,
    marginBottom: 10,
  },
  quadrado: {
    width: "100%",
    height: "40%",
    borderWidth: 1,
    borderColor: "gray",
    marginBottom: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  empresaContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  empresaNome: {
    fontSize: 18,
    marginRight: 10,
  },
  entrarButton: {
    backgroundColor: "#007bff",
    padding: 10,
    borderRadius: 5,
  },
  entrarButtonText: {
    color: "#fff",
    fontSize: 16,
  },
  aceitarButton: {
    backgroundColor: "#28a745",
    padding: 10,
    borderRadius: 5,
    marginLeft: 10,
  },
  aceitarButtonText: {
    color: "#fff",
    fontSize: 16,
  },
  negarButton: {
    backgroundColor: "#dc3545",
    padding: 10,
    borderRadius: 5,
    marginLeft: 10,
  },
  negarButtonText: {
    color: "#fff",
    fontSize: 16,
  },
  error: {
    color: "red",
  },
});

export default HallScreen;