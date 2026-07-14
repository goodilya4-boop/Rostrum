const PresentationService = require('../services/presentation.service');
const ProtectedFileService = require('../services/protected-file.service');
const env = require('../config/env');

const PresentationsController = {
  async list(req, res, next) {
    try {
      const presentations = await PresentationService.getUserPresentations(req.user.user_id);
      res.json({ presentations });
    } catch (error) {
      next(error);
    }
  },

  async upload(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: { message: 'Файл не загружен', status: 400 }
        });
      }

      const result = await PresentationService.uploadPresentation(req.user.user_id, req.file);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const presentation = await PresentationService.getPresentation(parseInt(req.params.id));

      // Проверяем права доступа
      if (presentation.user_id !== req.user.user_id) {
        return res.status(403).json({
          error: { message: 'Доступ запрещен', status: 403 }
        });
      }

      res.json({ presentation: PresentationService.toPublicPresentation(presentation) });
    } catch (error) {
      next(error);
    }
  },

  async getSlides(req, res, next) {
    try {
      const presentationId = parseInt(req.params.id);
      const presentation = await PresentationService.getPresentation(presentationId);

      // Проверяем права доступа
      if (presentation.user_id !== req.user.user_id) {
        return res.status(403).json({
          error: { message: 'Доступ запрещен', status: 403 }
        });
      }

      const result = await PresentationService.getSlides(presentationId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async updateKeyPhrases(req, res, next) {
    try {
      const presentationId = parseInt(req.params.id);
      const slideIndex = parseInt(req.params.slideIndex);
      const { key_phrases } = req.body;

      const presentation = await PresentationService.getPresentation(presentationId);

      // Проверяем права доступа
      if (presentation.user_id !== req.user.user_id) {
        return res.status(403).json({
          error: { message: 'Доступ запрещен', status: 403 }
        });
      }

      const slide = await PresentationService.updateSlideKeyPhrases(
        presentationId, slideIndex, key_phrases
      );

      res.json({ slide });
    } catch (error) {
      next(error);
    }
  },

  async getSlideImage(req, res, next) {
    try {
      const presentationId = parseInt(req.params.id);
      const slideIndex = parseInt(req.params.slideIndex);
      const presentation = await PresentationService.getPresentation(presentationId);

      if (presentation.user_id !== req.user.user_id) {
        return res.status(403).json({
          error: { message: 'Доступ запрещен', status: 403 }
        });
      }

      const imagePath = await PresentationService.getSlideImagePath(presentationId, slideIndex);
      const file = await ProtectedFileService.open(imagePath, [env.upload.slideImageDir]);
      res.set({
        'Cache-Control': 'private, no-store',
        'Content-Type': file.contentType,
        'Content-Length': String(file.size),
        'Content-Disposition': 'inline',
      });
      const stream = file.handle.createReadStream({ autoClose: true });
      stream.on('error', next);
      return stream.pipe(res);
    } catch (error) {
      next(error);
    }
  },

  async delete(req, res, next) {
    try {
      const presentationId = parseInt(req.params.id);
      const presentation = await PresentationService.getPresentation(presentationId);

      // Проверяем права доступа
      if (presentation.user_id !== req.user.user_id) {
        return res.status(403).json({
          error: { message: 'Доступ запрещен', status: 403 }
        });
      }

      await PresentationService.deletePresentation(presentationId);
      res.json({ message: 'Презентация удалена' });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = PresentationsController;
