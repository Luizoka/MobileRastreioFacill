import AsyncStorage from '@react-native-async-storage/async-storage';
import {jwtDecode} from 'jwt-decode';
import { API_BASE_URL } from '@env';

interface DecodedToken {
  exp: number;
}

export const getToken = async (): Promise<string | null> => {
  try {
    const token = await AsyncStorage.getItem('token');
    return token;
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
};

export const getRefreshToken = async (): Promise<string | null> => {
  try {
    const refreshToken = await AsyncStorage.getItem('refreshToken');
    return refreshToken;
  } catch (error) {
    console.error('Error getting refresh token:', error);
    return null;
  }
};

export const getTrustedDeviceToken = async (): Promise<string | null> => {
  try {
    const trustedDeviceToken = await AsyncStorage.getItem('trustedDeviceToken');
    return trustedDeviceToken;
  } catch (error) {
    console.error('Error getting trusted device token:', error);
    return null;
  }
};

export const isTokenValid = (token: string): boolean => {
  try {
    const decoded: DecodedToken = jwtDecode(token);
    const currentTime = Date.now() / 1000;
    return decoded.exp > currentTime;
  } catch (error) {
    console.error('Error decoding token:', error);
    return false;
  }
};

export const isTokenExpired = async (): Promise<boolean> => {
  try {
    const token = await getToken();
    if (!token) return true;
    
    const expirationTime = await AsyncStorage.getItem('tokenExpiration');
    if (!expirationTime) return true;
    
    const currentTime = Date.now();
    const expiration = parseInt(expirationTime);
    
    return currentTime >= expiration;
  } catch (error) {
    console.error('Error checking token expiration:', error);
    return true;
  }
};

export const refreshAccessToken = async (): Promise<boolean> => {
  try {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) {
      console.log('No refresh token available');
      return false;
    }

    const response = await fetch(`${API_BASE_URL}/api/users/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refreshToken
      }),
    });

    if (response.status === 200) {
      const data = await response.json();
      const { token, refreshToken: newRefreshToken, expiresIn } = data;
      
      // Salvar novos tokens
      await AsyncStorage.setItem('token', token);
      if (newRefreshToken) {
        await AsyncStorage.setItem('refreshToken', newRefreshToken);
      }
      
      // Salvar informações de expiração
      const expirationTime = Date.now() + (expiresIn * 1000);
      await AsyncStorage.setItem('tokenExpiration', expirationTime.toString());
      
      console.log('Token refreshed successfully');
      return true;
    } else {
      console.log('Failed to refresh token:', response.status);
      return false;
    }
  } catch (error) {
    console.error('Error refreshing token:', error);
    return false;
  }
};

export const getValidToken = async (): Promise<string | null> => {
  try {
    // Verificar se o token atual é válido
    const token = await getToken();
    if (token && isTokenValid(token)) {
      return token;
    }
    
    // Se o token não é válido, tentar renovar
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return await getToken();
    }
    
    return null;
  } catch (error) {
    console.error('Error getting valid token:', error);
    return null;
  }
};

export const removeToken = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('refreshToken');
    await AsyncStorage.removeItem('trustedDeviceToken');
    await AsyncStorage.removeItem('tokenExpiration');
  } catch (error) {
    console.error('Error removing tokens:', error);
  }
};

export const clearAllAuthData = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('refreshToken');
    await AsyncStorage.removeItem('trustedDeviceToken');
    await AsyncStorage.removeItem('tokenExpiration');
    await AsyncStorage.removeItem('userId');
  } catch (error) {
    console.error('Error clearing auth data:', error);
  }
};