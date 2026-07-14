const PresentationModel = require('../models/presentation.model');
const KeyPhraseService = require('./keyphrase.service');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const AppError = require('../utils/AppError');
const { withTransaction } = require('../db/transaction');
const PresentationParser = require('./presentation-parser.service');
const SlideImageService = require('./slide-image.service');

function toPublicPresentation(presentation) {
  if (!presentation) return presentation;
  const { file_path: filePath, ...publicPresentation } = presentation;
  return publicPresentation;
}

function toPublicSlide(slide, presentationId) {
  const { image_path: imagePath, ...publicSlide } = slide;
  return {
    ...publicSlide,
    image_url: imagePath
      ? `/presentations/${presentationId}/slides/${slide.slide_index}/image`
      : null,
  };
}

const PresentationService = {
  async getUserPresentations(userId) {
    const presentations = await PresentationModel.findByUser(userId);
    return presentations.map(toPublicPresentation);
  },

  async getPresentation(presentationId) {
    const presentation = await PresentationModel.findById(presentationId);
    if (!presentation) {
      throw new AppError('Презентация не найдена', 404);
    }
    return presentation;
  },

  async uploadPresentation(userId, file) {
    logger.info(`Processing presentation upload: ${file.originalname}`);
    let renderedImages = null;

    try {
      await fs.chmod(file.path, 0o600).catch(error => {
        logger.warn({ error: error.message, file: file.path }, 'Could not restrict upload permissions');
      });
      const slides = await this.parsePresentation(file);
      renderedImages = await SlideImageService.renderSlides(file, slides);
      const preparedSlides = slides.map((slide, index) => {
        const extractedText = slide.text || '';
        return {
          slideIndex: index + 1,
          extractedText,
          keyPhrases: KeyPhraseService.extractKeyPhrases(extractedText, 5),
          imagePath: renderedImages.imagePaths[index],
        };
      });

      const result = await withTransaction(async client => {
        const presentation = await PresentationModel.create({
          userId,
          title: file.originalname.replace(/\.[^/.]+$/, ''),
          filePath: file.path,
          slideCount: preparedSlides.length,
        }, client);

        for (const slide of preparedSlides) {
          await PresentationModel.createSlide({
            presentationId: presentation.id,
            ...slide,
          }, client);
          logger.info(`Slide ${slide.slideIndex}: extracted ${slide.keyPhrases.length} key phrases`);
        }

        return {
          ...toPublicPresentation(presentation),
          slides: preparedSlides.map(({ imagePath, ...slide }) => ({
            ...slide,
            image_url: `/presentations/${presentation.id}/slides/${slide.slideIndex}/image`,
          })),
          image_renderer: renderedImages.renderer,
        };
      });

      logger.info(`Presentation created: ${result.id} with ${result.slides.length} slides`);
      return result;
    } catch (error) {
      if (renderedImages?.imagePaths) {
        try {
          await SlideImageService.removeSlideImages(renderedImages.imagePaths);
        } catch (cleanupError) {
          logger.error('Error cleaning up generated slide images', cleanupError);
        }
      }
      try {
        await fs.unlink(file.path);
      } catch (cleanupError) {
        if (cleanupError.code !== 'ENOENT') {
          logger.error(`Error cleaning up failed upload: ${file.path}`, cleanupError);
        }
      }
      throw error;
    }
  },

  async parsePresentation(file) {
    return PresentationParser.parsePresentation(file);
  },

  async getSlides(presentationId) {
    const presentation = await this.getPresentation(presentationId);
    const slides = await PresentationModel.getSlides(presentationId);
    return {
      presentation: toPublicPresentation(presentation),
      slides: slides.map(slide => toPublicSlide(slide, presentationId)),
    };
  },

  async getSlideImagePath(presentationId, slideIndex) {
    const slide = await PresentationModel.findSlideByIndex(presentationId, slideIndex);
    if (!slide || !slide.image_path) {
      throw new AppError('Изображение слайда не найдено', 404);
    }
    try {
      await fs.access(slide.image_path);
    } catch {
      throw new AppError('Файл изображения слайда не найден', 404);
    }
    return slide.image_path;
  },

  async updateSlideKeyPhrases(presentationId, slideIndex, keyPhrases) {
    const slide = await PresentationModel.findSlideByIndex(presentationId, slideIndex);
    if (!slide) {
      throw new AppError('Слайд не найден', 404);
    }

    return await PresentationModel.updateSlideKeyPhrases(slide.id, keyPhrases);
  },

  async deletePresentation(presentationId) {
    const presentation = await PresentationModel.findById(presentationId);
    if (!presentation) {
      throw new AppError('Презентация не найдена', 404);
    }
    const slides = await PresentationModel.getSlides(presentationId);

    // Сначала удаляем запись и связанные данные в БД. Файловая система не может
    // участвовать в PostgreSQL-транзакции, поэтому файл очищаем после успешного DELETE.
    await PresentationModel.delete(presentationId);

    if (presentation.file_path) {
      try {
        await fs.unlink(presentation.file_path);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          logger.error(`Error deleting file: ${presentation.file_path}`, error);
        }
      }
    }
    try {
      await SlideImageService.removeSlideImages(slides.map(slide => slide.image_path));
    } catch (error) {
      logger.error(`Error deleting slide images for presentation ${presentationId}`, error);
    }
    logger.info(`Presentation deleted: ${presentationId}`);
  },
};

PresentationService.toPublicPresentation = toPublicPresentation;

module.exports = PresentationService;
