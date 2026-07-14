const db = require('../config/db');

const UserModel = {
  async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1';
    const { rows } = await db.query(query, [email]);
    return rows[0];
  },

  async findById(id) {
    const query = 'SELECT id, email, last_name, first_name, middle_name, default_time_limit, prefer_offline_asr, settings_json, created_at FROM users WHERE id = $1';
    const { rows } = await db.query(query, [id]);
    return rows[0];
  },

  async findByIdWithPassword(id) {
    const { rows } = await db.query(
      'SELECT id, password_hash FROM users WHERE id = $1',
      [id]
    );
    return rows[0] || null;
  },

  async create({ email, passwordHash, lastName, firstName, middleName }) {
    const query = `
      INSERT INTO users (email, password_hash, last_name, first_name, middle_name)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, last_name, first_name, middle_name, default_time_limit, prefer_offline_asr, created_at
    `;
    const { rows } = await db.query(query, [email, passwordHash, lastName, firstName, middleName]);
    return rows[0];
  },

  async update(id, fields) {
    const allowedFields = ['default_time_limit', 'prefer_offline_asr', 'settings_json', 'last_name', 'first_name', 'middle_name'];
    const updates = [];
    const values = [];
    let paramCount = 0;

    for (const [key, value] of Object.entries(fields)) {
      if (allowedFields.includes(key)) {
        paramCount++;
        updates.push(`${key} = $${paramCount}`);
        values.push(value);
      }
    }

    if (updates.length === 0) return null;

    paramCount++;
    values.push(id);

    const query = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, email, last_name, first_name, middle_name, default_time_limit, prefer_offline_asr, settings_json, created_at
    `;

    const { rows } = await db.query(query, values);
    return rows[0];
  },

  async updatePassword(id, passwordHash) {
    const { rowCount } = await db.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, id]
    );
    return rowCount === 1;
  },
};

module.exports = UserModel;
