import apiClient from './client';

export const authAPI = {
  register(data) {
    return apiClient.post('/auth/register', data);
  },
  login(data) {
    return apiClient.post('/auth/login', data);
  },
  getMe() {
    return apiClient.get('/auth/me');
  }
};