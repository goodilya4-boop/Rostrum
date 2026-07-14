import apiClient from './client';

export const presentationsAPI = {
  getAll() {
    return apiClient.get('/presentations');
  },

  getById(id) {
    return apiClient.get(`/presentations/${id}`);
  },

  upload(formData, onUploadProgress) {
    return apiClient.post('/presentations', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
      onUploadProgress
    });
  },

  getSlides(id) {
    return apiClient.get(`/presentations/${id}/slides`);
  },

  getSlideImage(url) {
    return apiClient.get(url, { responseType: 'blob' });
  },

  updateKeyPhrases(presentationId, slideIndex, keyPhrases) {
    return apiClient.patch(
      `/presentations/${presentationId}/slides/${slideIndex}`,
      { key_phrases: keyPhrases }
    );
  },

  delete(id) {
    return apiClient.delete(`/presentations/${id}`);
  }
};
