import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { getValidToken } from '../utils/auth';
import { API_BASE_URL } from '@env';

interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onLogout: () => void;
}

interface UserProfile {
  id: number;
  name: string;
  email: string;
  contact: string;
}

const ProfileModal = ({ visible, onClose, onLogout }: ProfileModalProps) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  
  // Estados para os campos editáveis
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  
  // Estado para indicar se está salvando alterações
  const [saving, setSaving] = useState(false);

  // Buscar o perfil do usuário quando o modal for aberto
  useEffect(() => {
    if (visible) {
      fetchUserProfile();
    }
  }, [visible]);

  // Atualizar os estados de edição quando o perfil for carregado
  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setContact(profile.contact);
    }
  }, [profile]);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      setError('');
      
      const token = await getValidToken();
      if (!token) {
        setError('Token não encontrado');
        return;
      }

      // Decodificar o token para obter o ID do usuário
      const tokenParts = token.split('.');
      const payload = JSON.parse(atob(tokenParts[1]));
      const userId = payload.id;

      const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 200) {
        const userData = await response.json();
        setProfile({
          id: userData.id,
          name: userData.name || '',
          email: userData.email || '',
          contact: userData.contact || '',
        });
        resetForm();
      } else {
        setError('Erro ao carregar perfil do usuário');
      }
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
      setError('Erro ao carregar perfil do usuário');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;

    setSaving(true);
    setError('');
    
    try {
      const token = await getValidToken();
      if (!token) {
        setError('Token não encontrado');
        setSaving(false);
        return;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/users/${profile.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          contact
        }),
      });
      
      const data = await response.json();
      
      if (response.status === 200) {
        // Atualizar o perfil local com os dados retornados
        setProfile({
          id: data.id,
          name: data.name,
          email: data.email,
          contact: data.contact
        });
        
        setEditMode(false);
        Alert.alert('Sucesso', 'Perfil atualizado com sucesso!');
      } else if (response.status === 404) {
        setError('Usuário não encontrado');
      } else if (response.status === 400) {
        setError('Erro de validação. Verifique os campos informados.');
      } else if (response.status === 500) {
        setError('Erro ao atualizar usuário. Tente novamente.');
      } else {
        setError(data.error || 'Erro ao atualizar perfil');
      }
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      setError('Erro ao atualizar perfil');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Confirmar Exclusão',
      'Tem certeza que deseja excluir sua conta? Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: confirmDeleteAccount },
      ]
    );
  };

  const confirmDeleteAccount = async () => {
    if (!profile) return;
    
    setLoading(true);
    setError('');
    
    try {
      const token = await getValidToken();
      if (!token) {
        setError('Token não encontrado');
        setLoading(false);
        return;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/users/${profile.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (response.status === 200) {
        Alert.alert(
          'Conta Excluída',
          'Sua conta foi excluída com sucesso.',
          [
            {
              text: 'OK',
              onPress: () => {
                onClose();
                onLogout();
              },
            },
          ]
        );
      } else {
        const data = await response.json();
        setError(data.error || 'Erro ao excluir conta');
      }
    } catch (error) {
      console.error('Erro ao excluir conta:', error);
      setError('Erro ao excluir conta');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    if (profile) {
      setName(profile.name);
      setContact(profile.contact);
    }
    setEditMode(false);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => {
        if (editMode) {
          resetForm();
        }
        onClose();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.centeredView}
      >
        <View style={styles.modalView}>
          <Text style={styles.modalTitle}>
            {editMode ? 'Editar Perfil' : 'Meu Perfil'}
          </Text>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1a73e8" />
              <Text style={styles.loadingText}>Carregando dados...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : profile ? (
            <ScrollView style={styles.profileContent}>
              <View style={styles.profileField}>
                <Text style={styles.fieldLabel}>Nome:</Text>
                {editMode ? (
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="Seu nome"
                  />
                ) : (
                  <Text style={styles.fieldValue}>{profile.name}</Text>
                )}
              </View>
              
              <View style={styles.profileField}>
                <Text style={styles.fieldLabel}>Email:</Text>
                <Text style={styles.fieldValue}>{profile.email}</Text>
              </View>
              
              <View style={styles.profileField}>
                <Text style={styles.fieldLabel}>Contato:</Text>
                {editMode ? (
                  <TextInput
                    style={styles.input}
                    value={contact}
                    onChangeText={setContact}
                    placeholder="Seu contato"
                    keyboardType="phone-pad"
                  />
                ) : (
                  <Text style={styles.fieldValue}>{profile.contact}</Text>
                )}
              </View>
              
              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
              
              <View style={styles.buttonsContainer}>
                {editMode ? (
                  <>
                    <TouchableOpacity
                      style={[styles.button, styles.saveButton]}
                      onPress={handleSaveProfile}
                      disabled={saving}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.buttonText}>Salvar</Text>
                      )}
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.button, styles.cancelButton]}
                      onPress={resetForm}
                      disabled={saving}
                    >
                      <Text style={styles.buttonText}>Cancelar</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={[styles.button, styles.editButton]}
                      onPress={() => setEditMode(true)}
                    >
                      <Text style={styles.buttonText}>Editar Perfil</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.button, styles.deleteButton]}
                      onPress={handleDeleteAccount}
                    >
                      <Text style={styles.buttonText}>Excluir Conta</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </ScrollView>
          ) : (
            <Text style={styles.emptyMessage}>Nenhuma informação disponível</Text>
          )}
          
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              if (editMode) {
                resetForm();
              }
              onClose();
            }}
          >
            <Text style={styles.closeButtonText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  profileContent: {
    width: '100%',
  },
  profileField: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f9f9f9',
  },
  buttonsContainer: {
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  editButton: {
    backgroundColor: '#1a73e8',
  },
  saveButton: {
    backgroundColor: '#28a745',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  closeButton: {
    marginTop: 20,
    backgroundColor: '#f1f1f1',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    backgroundColor: 'rgba(220, 53, 69, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginVertical: 10,
  },
  errorText: {
    color: '#dc3545',
    textAlign: 'center',
  },
  emptyMessage: {
    textAlign: 'center',
    color: '#666',
    padding: 20,
    fontStyle: 'italic',
  },
});

export default ProfileModal; 