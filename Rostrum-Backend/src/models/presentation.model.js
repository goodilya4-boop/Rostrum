const db = require('../config/db');

const PresentationModel = {
  async findByUser(userId) {
    const query = 'SELECT * FROM presentations WHERE user_id = $1 ORDER BY created_at DESC';
    const { rows } = await db.query(query, [userId]);
    return rows;
  },

  async findById(id) {
    const query = 'SELECT * FROM presentations WHERE id = $1';
    const { rows } = await db.query(query, [id]);
    return rows[0];
  },

  async create({ userId, title, filePath, slideCount }, executor = db) {
    const query = `
      INSERT INTO presentations (user_id, title, file_path, slide_count)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const { rows } = await executor.query(query, [userId, title, filePath, slideCount]);
    return rows[0];
  },

  async delete(id) {
    const query = 'DELETE FROM presentations WHERE id = $1 RETURNING *';
    const { rows } = await db.query(query, [id]);
    return rows[0];
  },

  async createSlide({ presentationId, slideIndex, extractedText, keyPhrases, imagePath }, executor = db) {
    const query = `
      INSERT INTO slides (presentation_id, slide_index, extracted_text, key_phrases, image_path)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const { rows } = await executor.query(
      query,
      [presentationId, slideIndex, extractedText, keyPhrases, imagePath]
    );
    return rows[0];
  },

  async getSlides(presentationId) {
    const query = 'SELECT * FROM slides WHERE presentation_id = $1 ORDER BY slide_index';
    const { rows } = await db.query(query, [presentationId]);
    return rows;
  },

  async updateSlideKeyPhrases(slideId, keyPhrases) {
    const query = `
      UPDATE slides
      SET key_phrases = $1
      WHERE id = $2
      RETURNING *
    `;
    const { rows } = await db.query(query, [keyPhrases, slideId]);
    return rows[0];
  },

  async findSlideByIndex(presentationId, slideIndex) {
    const query = 'SELECT * FROM slides WHERE presentation_id = $1 AND slide_index = $2';
    const { rows } = await db.query(query, [presentationId, slideIndex]);
    return rows[0];
  },
};

module.exports = PresentationModel;
