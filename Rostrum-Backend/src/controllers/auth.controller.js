const AuthService = require('../services/auth.service');

const AuthController = {
  async register(req, res, next) {
    try {
      const { email, password, last_name, first_name, middle_name } = req.body;

      const result = await AuthService.register({
        email,
        password,
        lastName: last_name,
        firstName: first_name,
        middleName: middle_name,
      });

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login({ email, password });
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async me(req, res, next) {
    try {
      const user = await AuthService.getProfile(req.user.user_id);
      res.json({ user });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = AuthController;