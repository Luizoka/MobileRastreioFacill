import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { removeToken, getToken } from '../utils/auth';
import { API_BASE_URL } from '@env';

interface Empresa {
  id: number;
  nome: string;
  logo: string;
  imagem: string;
  setor_atuacao: string;
  telefone_suporte: string;
  email_suporte: string;
  ativo: number;
}

const HallScreen = ({ onNavigateToMap, onLogout, onNavigateToLogin }: { onNavigateToMap: (id_empresa: number) => void, onLogout: () => void, onNavigateToLogin: () => void }) => {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [error, setError] = useState('');

  const handleLogout = async () => {
    await removeToken();
    onLogout();
    onNavigateToLogin();
  };

  useEffect(() => {
    const fetchEmpresas = async () => {
      const token = await getToken();
      if (!token) {
        setError('Token not found');
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/funcionario/empresas-vinculadas`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          },
        });

        console.log(response)

        if (response.status === 200) {
          const data = await response.json();
          const empresasComNome = await Promise.all(data.map(async (empresa: Empresa) => {
            const empresaResponse = await fetch(`${API_BASE_URL}/api/empresas/${empresa.id}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`
              },
            });
            if (empresaResponse.status === 200) {
              const empresaData = await empresaResponse.json();
              return { ...empresa, nome: empresaData.nome };
            } else {
              return empresa;
            }
          }));
          setEmpresas(empresasComNome);
        } else if (response.status === 404) {
          const data = await response.json();
          setError(data.message || 'Nenhuma empresa vinculada encontrada.');
        } else {
          const data = await response.json();
          setError(data.error || 'Erro ao buscar solicitações.');
        }
      } catch (error) {
        setError('Erro ao buscar solicitações.');
      }
    };

    fetchEmpresas();
  }, []);

  const renderEmpresa = ({ item }: { item: Empresa }) => (
    <View style={styles.empresaContainer}>
      <Text style={styles.empresaNome}>{item.nome}</Text>
      <TouchableOpacity style={styles.entrarButton} onPress={() => onNavigateToMap(item.id)}>
        <Text style={styles.entrarButtonText}>Entrar</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bem-vindo ao Hall</Text>
      <View style={styles.quadrado}>
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <FlatList
            data={empresas}
            renderItem={renderEmpresa}
            keyExtractor={(item) => item.id.toString()}
          />
        )}
      </View>
      <View style={styles.quadrado}>
        {/* Segundo quadrado, aguardando implementação */}
      </View>
      <Button title="Logout" onPress={handleLogout} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
  },
  quadrado: {
    width: '100%',
    height: '40%',
    borderWidth: 1,
    borderColor: 'gray',
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empresaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  empresaNome: {
    fontSize: 18,
    marginRight: 10,
  },
  entrarButton: {
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 5,
  },
  entrarButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  error: {
    color: 'red',
  },
});

export default HallScreen;