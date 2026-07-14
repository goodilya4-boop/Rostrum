const express = require('express');
const { body, param } = require('express-validator');
const SessionsController = require('../controllers/sessions.controller');
const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validate');
const audioUpload = require('../middleware/audioUpload');
const { AUDIO_FIELD_NAME } = require('../services/asr-contract');

const router = express.Router();

router.get('/asr/capabilities', authMiddleware, SessionsController.getAsrCapabilities);

// История сессий с пагинацией
router.get('/', authMiddleware, SessionsController.list);

// Создание новой сессии
router.post('/', authMiddleware, [
  body('presentation_id').isInt().withMessage('presentation_id обязателен'),
  body('time_limit_sec').optional().isInt({ min: 60, max: 1800 }).withMessage('Лимит времени от 60 до 1800 секунд'),
  body('speech_engine').optional().isIn(['web', 'vosk']).withMessage('Движок должен быть web или vosk'),
  validate,
], SessionsController.create);

// Получение детального отчета
router.get('/:id', authMiddleware, SessionsController.getById);

router.get('/:id/asr/chunks', authMiddleware, [
  param('id').isInt({ min: 1 }),
  validate,
], SessionsController.listAsrChunks);

// Добавление переключений слайдов
router.post('/:id/slide-changes', authMiddleware, [
  param('id').isInt({ min: 1 }),
  body('changes').isArray({ min: 1 }),
  body('changes.*.slide_index').isInt({ min: 1 }),
  body('changes.*.timestamp_offset_ms').isInt({ min: 0 }),
  validate,
], SessionsController.addSlideChanges);

// Добавление транскриптов
router.post('/:id/transcripts', authMiddleware, [
  param('id').isInt({ min: 1 }),
  body('segments').isArray({ min: 1, max: 500 }),
  body('segments.*.segment_id').isString().isLength({ min: 1, max: 100 }),
  body('segments.*.start_ms').isInt({ min: 0 }),
  body('segments.*.end_ms').isInt({ min: 0 }),
  body('segments.*.spoken_text').isString().isLength({ min: 1, max: 5000 }),
  body('segments.*.confidence').optional().isFloat({ min: 0, max: 1 }),
  body('segments.*').custom(segment => {
    if (Number(segment.end_ms) < Number(segment.start_ms)) {
      throw new Error('end_ms должен быть больше или равен start_ms');
    }
    return true;
  }),
  validate,
], SessionsController.addTranscripts);

router.post(
  '/:id/asr/vosk',
  authMiddleware,
  audioUpload.single(AUDIO_FIELD_NAME),
  [
    param('id').isInt({ min: 1 }),
    body('chunk_id')
      .isString()
      .matches(/^[A-Za-z0-9_-]{1,80}$/)
      .withMessage('chunk_id: 1–80 символов A-Z, a-z, 0-9, _ или -'),
    body('offset_ms').isInt({ min: 0, max: 2147483647 }),
    validate,
  ],
  SessionsController.transcribeVoskChunk
);

// Завершение сессии
router.patch('/:id/complete', authMiddleware, SessionsController.complete);

// Повторный анализ
router.post('/:id/reanalyze', authMiddleware, SessionsController.reanalyze);

module.exports = router;
