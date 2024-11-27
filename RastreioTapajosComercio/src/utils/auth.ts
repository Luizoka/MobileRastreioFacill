import AsyncStorage from '@react-native-async-storage/async-storage';
import {jwtDecode} from 'jwt-decode';

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

export const removeToken = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem('token');
  } catch (error) {
    console.error('Error removing token:', error);
  }
};