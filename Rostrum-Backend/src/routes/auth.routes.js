const express = require('express');
const { body } = require('express-validator');
const AuthController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.post('/register', [
  body('email').isEmail().withMessage('Некорректный email'),
  body('password').isLength({ min: 6 }).withMessage('Пароль должен быть не менее 6 символов'),
  body('last_name').notEmpty().withMessage('Фамилия обязательна'),
  body('first_name').notEmpty().withMessage('Имя обязательно'),
  validate,
], AuthController.register);

router.post('/login', [
  body('email').isEmail().withMessage('Некорректный email'),
  body('password').notEmpty().withMessage('Пароль обязателен'),
  validate,
], AuthController.login);

router.get('/me', authMiddleware, AuthController.me);

module.exports = router;