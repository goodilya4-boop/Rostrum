import apiClient from './client';

export const usersAPI = {
  getProfile(userId) {
    return apiClient.get(`/users/${userId}`);
  },

  updateProfile(userId, fields) {
    return apiClient.patch(`/users/${userId}`, fields);
  },

  changePassword(userId, currentPassword, newPassword) {
    return apiClient.patch(`/users/${userId}/password`, {
      current_password: currentPassword,
      new_password: newPassword,
    });
  },
};
