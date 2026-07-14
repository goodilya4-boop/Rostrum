const { validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: {
        message: 'Ошибка валидации',
        errors: errors.array(),
        status: 400
      }
    });
  }
  next();
};

module.exports = validate;