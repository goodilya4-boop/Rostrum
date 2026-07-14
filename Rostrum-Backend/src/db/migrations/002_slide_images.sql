ALTER TABLE slides
ADD COLUMN image_path TEXT;

COMMENT ON COLUMN slides.image_path IS
'Внутренний путь к PNG или SVG-изображению слайда; файл выдаётся только через авторизованный API';
