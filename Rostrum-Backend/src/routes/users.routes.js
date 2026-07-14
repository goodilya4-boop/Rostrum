const express = require('express');
const { body, param } = require('express-validator');
const UsersController = require('../controllers/users.controller');
const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

const userIdValidation = param('id').isInt({ min: 1 }).withMessage('Некорректный идентификатор пользователя');

router.get('/:id', authMiddleware, [userIdValidation, validate], UsersController.getProfile);

router.patch('/:id', authMiddleware, [
  userIdValidation,
  body().custom(value => {
    const allowed = new Set([
      'default_time_limit', 'prefer_offline_asr', 'settings_json',
      'last_name', 'first_name', 'middle_name',
    ]);
    const keys = Object.keys(value || {});
    if (keys.length === 0) throw new Error('Не указаны поля для обновления');
    const unknown = keys.filter(key => !allowed.has(key));
    if (unknown.length) throw new Error(`Неизвестные поля: ${unknown.join(', ')}`);
    return true;
  }),
  body('default_time_limit').optional().isInt({ min: 60, max: 1800 }).withMessage('Лимит времени должен быть от 60 до 1800 секунд'),
  body('prefer_offline_asr').optional().isBoolean().withMessage('prefer_offline_asr должен быть boolean'),
  body('last_name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Фамилия должна содержать от 1 до 100 символов'),
  body('first_name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Имя должно содержать от 1 до 100 символов'),
  body('middle_name').optional({ nullable: true }).trim().isLength({ max: 100 }).withMessage('Отчество не должно превышать 100 символов'),
  body('settings_json').optional().custom(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('settings_json должен быть объектом');
    }
    if (JSON.stringify(value).length > 4096) throw new Error('settings_json слишком большой');
    if (value.theme !== undefined && !['light', 'dark'].includes(value.theme)) {
      throw new Error('Допустимые темы: light или dark');
    }
    return true;
  }),
  validate,
], UsersController.updateProfile);

router.patch('/:id/password', authMiddleware, [
  userIdValidation,
  body().custom(value => {
    const allowed = new Set(['current_password', 'new_password']);
    const unknown = Object.keys(value || {}).filter(key => !allowed.has(key));
    if (unknown.length) throw new Error(`Неизвестные поля: ${unknown.join(', ')}`);
    return true;
  }),
  body('current_password')
    .isString()
    .isLength({ min: 1, max: 128 })
    .withMessage('Текущий пароль обязателен и не должен превышать 128 символов'),
  body('new_password')
    .isString()
    .isLength({ min: 8, max: 128 })
    .withMessage('Новый пароль должен содержать от 8 до 128 символов'),
  validate,
], UsersController.changePassword);

module.exports = router;
