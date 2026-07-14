const UserModel = require('../models/user.model');
const AuthService = require('../services/auth.service');

const UsersController = {
  async getProfile(req, res, next) {
    try {
      const userId = parseInt(req.params.id);

      // Проверяем права доступа
      if (req.user.user_id !== userId) {
        return res.status(403).json({
          error: { message: 'Доступ запрещен', status: 403 }
        });
      }

      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(404).json({
          error: { message: 'Пользователь не найден', status: 404 }
        });
      }

      res.json({ user });
    } catch (error) {
      next(error);
    }
  },

  async updateProfile(req, res, next) {
    try {
      const userId = parseInt(req.params.id);

      // Проверяем права доступа
      if (req.user.user_id !== userId) {
        return res.status(403).json({
          error: { message: 'Доступ запрещен', status: 403 }
        });
      }

      const { default_time_limit, prefer_offline_asr, settings_json, last_name, first_name, middle_name } = req.body;

      const updates = {};
      if (default_time_limit !== undefined) updates.default_time_limit = default_time_limit;
      if (prefer_offline_asr !== undefined) updates.prefer_offline_asr = prefer_offline_asr;
      if (settings_json !== undefined) updates.settings_json = settings_json;
      if (last_name !== undefined) updates.last_name = last_name;
      if (first_name !== undefined) updates.first_name = first_name;
      if (middle_name !== undefined) updates.middle_name = middle_name?.trim() || null;

      const user = await UserModel.update(userId, updates);
      if (!user) {
        return res.status(404).json({
          error: { message: 'Пользователь не найден', status: 404 }
        });
      }

      res.json({ user });
    } catch (error) {
      next(error);
    }
  },

  async changePassword(req, res, next) {
    try {
      const userId = parseInt(req.params.id);
      if (req.user.user_id !== userId) {
        return res.status(403).json({
          error: { message: 'Доступ запрещен', status: 403 }
        });
      }

      await AuthService.changePassword({
        userId,
        currentPassword: req.body.current_password,
        newPassword: req.body.new_password,
      });
      res.json({ message: 'Пароль успешно изменён' });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = UsersController;
