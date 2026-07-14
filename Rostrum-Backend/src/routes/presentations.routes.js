const express = require('express');
const { body } = require('express-validator');
const PresentationsController = require('../controllers/presentations.controller');
const authMiddleware = require('../middleware/auth');
const upload = require('../middleware/upload');
const validate = require('../middleware/validate');

const router = express.Router();

router.get('/', authMiddleware, PresentationsController.list);

router.post('/', authMiddleware, upload.single('presentation'), PresentationsController.upload);

router.get('/:id', authMiddleware, PresentationsController.getById);

router.get('/:id/slides', authMiddleware, PresentationsController.getSlides);

router.get('/:id/slides/:slideIndex/image', authMiddleware, PresentationsController.getSlideImage);

router.patch('/:id/slides/:slideIndex', authMiddleware, [
  body('key_phrases').isArray().withMessage('key_phrases должен быть массивом'),
  validate,
], PresentationsController.updateKeyPhrases);

router.delete('/:id', authMiddleware, PresentationsController.delete);

module.exports = router;
