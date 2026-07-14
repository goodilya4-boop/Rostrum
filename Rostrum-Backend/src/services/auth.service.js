const bcrypt = require('bcrypt');
const UserModel = require('../models/user.model');
const { generateToken } = require('../utils/jwt');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

const AuthService = {
  async register({ email, password, lastName, firstName, middleName }) {
    // Проверяем, существует ли пользователь
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      throw new AppError('Пользователь с таким email уже существует', 409);
    }

    // Хешируем пароль
    const passwordHash = await bcrypt.hash(password, 12);

    // Создаем пользователя
    const user = await UserModel.create({
      email,
      passwordHash,
      lastName,
      firstName,
      middleName,
    });

    // Генерируем токен
    const token = generateToken({ user_id: user.id, email: user.email });

    logger.info(`User registered: ${email}`);

    return { user, token };
  },

  async login({ email, password }) {
    // Находим пользователя
    const user = await UserModel.findByEmail(email);
    if (!user) {
      throw new AppError('Неверный email или пароль', 401);
    }

    // Проверяем пароль
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      throw new AppError('Неверный email или пароль', 401);
    }

    // Генерируем токен
    const token = generateToken({ user_id: user.id, email: user.email });

    // Убираем password_hash из ответа
    const { password_hash, ...userWithoutPassword } = user;

    logger.info(`User logged in: ${email}`);

    return { user: userWithoutPassword, token };
  },

  async getProfile(userId) {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new AppError('Пользователь не найден', 404);
    }
    return user;
  },

  async changePassword({ userId, currentPassword, newPassword }) {
    const user = await UserModel.findByIdWithPassword(userId);
    if (!user || !await bcrypt.compare(currentPassword, user.password_hash)) {
      throw new AppError('Текущий пароль указан неверно', 400);
    }
    if (await bcrypt.compare(newPassword, user.password_hash)) {
      throw new AppError('Новый пароль должен отличаться от текущего', 400);
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const updated = await UserModel.updatePassword(userId, passwordHash);
    if (!updated) throw new AppError('Пользователь не найден', 404);
    logger.info(`Password changed for user ${userId}`);
  },
};

module.exports = AuthService;
