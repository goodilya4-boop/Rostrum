CREATE OR REPLACE FUNCTION update_presentation_slide_count()
RETURNS TRIGGER AS $$
DECLARE
    affected_presentation_id INT;
BEGIN
    affected_presentation_id := CASE WHEN TG_OP = 'DELETE'
        THEN OLD.presentation_id ELSE NEW.presentation_id END;

    UPDATE presentations
    SET slide_count = (
        SELECT COUNT(*)::INT
        FROM slides
        WHERE presentation_id = affected_presentation_id
    )
    WHERE id = affected_presentation_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

UPDATE presentations p
SET slide_count = (
    SELECT COUNT(*)::INT
    FROM slides s
    WHERE s.presentation_id = p.id
);

DO $$
DECLARE
    item RECORD;
    decoded_title TEXT;
BEGIN
    FOR item IN SELECT id, title FROM presentations WHERE title ~ '[ÐÑ]' LOOP
        BEGIN
            decoded_title := convert_from(convert_to(item.title, 'LATIN1'), 'UTF8');
            IF decoded_title ~ '[А-Яа-яЁё]' THEN
                UPDATE presentations SET title = decoded_title WHERE id = item.id;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION update_presentation_slide_count() IS
'Пересчитывает фактическое количество слайдов после INSERT или DELETE и не допускает накопления ошибок счётчика';
