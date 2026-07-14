-- ===========================
-- 1. Пользователи (студенты)
-- ===========================
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,                     -- уникальный идентификатор
    email           VARCHAR(255) UNIQUE NOT NULL,           -- логин (email)
    password_hash   TEXT NOT NULL,                          -- хеш пароля (bcrypt)
    last_name       VARCHAR(100) NOT NULL,                  -- фамилия
    first_name      VARCHAR(100) NOT NULL,                  -- имя
    middle_name     VARCHAR(100),                           -- отчество (может быть NULL)
    default_time_limit   INT DEFAULT 420,                   -- регламент по умолчанию, сек (5/7 мин)
    prefer_offline_asr   BOOLEAN DEFAULT true,              -- предпочтение локального распознавания
    settings_json   JSONB DEFAULT '{}'::jsonb,              -- прочие настройки интерфейса
    created_at      TIMESTAMPTZ DEFAULT now()              -- дата регистрации
);

COMMENT ON TABLE users IS 'Зарегистрированные пользователи (студенты, возможно, преподаватели)';
COMMENT ON COLUMN users.id IS 'Первичный ключ';
COMMENT ON COLUMN users.email IS 'Логин – адрес электронной почты, уникален';
COMMENT ON COLUMN users.password_hash IS 'Хеш пароля, полученный с помощью bcrypt';
COMMENT ON COLUMN users.last_name IS 'Фамилия пользователя';
COMMENT ON COLUMN users.first_name IS 'Имя пользователя';
COMMENT ON COLUMN users.middle_name IS 'Отчество (при отсутствии – NULL)';
COMMENT ON COLUMN users.default_time_limit IS 'Стандартное время защиты в секундах (5 мин = 300, 7 мин = 420)';
COMMENT ON COLUMN users.prefer_offline_asr IS 'Если true – использовать Vosk (приватность), иначе Web Speech API';
COMMENT ON COLUMN users.settings_json IS 'Пользовательские настройки UI (язык, тема и т.п.) в формате JSON';
COMMENT ON COLUMN users.created_at IS 'Дата и время регистрации (UTC)';

-- ===========================
-- 2. Презентации
-- ===========================
CREATE TABLE presentations (
    id          SERIAL PRIMARY KEY,
    user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    file_path   TEXT,                       -- путь к загруженному файлу
    slide_count INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE presentations IS 'Загруженные студентом файлы презентаций';
COMMENT ON COLUMN presentations.id IS 'Первичный ключ';
COMMENT ON COLUMN presentations.user_id IS 'Владелец презентации (внешний ключ к users)';
COMMENT ON COLUMN presentations.title IS 'Название презентации, заданное пользователем';
COMMENT ON COLUMN presentations.file_path IS 'Физический путь к файлу в хранилище (может отсутствовать)';
COMMENT ON COLUMN presentations.slide_count IS 'Количество слайдов, извлечённое при разборе файла';
COMMENT ON COLUMN presentations.created_at IS 'Дата и время загрузки';

-- Индекс для быстрого поиска всех презентаций пользователя
CREATE INDEX idx_presentations_user_id ON presentations(user_id);
COMMENT ON INDEX idx_presentations_user_id IS 'Ускоряет выборку презентаций по владельцу';

-- ===========================
-- 3. Слайды
-- ===========================
CREATE TABLE slides (
    id              SERIAL PRIMARY KEY,
    presentation_id INT NOT NULL REFERENCES presentations(id) ON DELETE CASCADE,
    slide_index     INT NOT NULL CHECK (slide_index > 0),
    extracted_text  TEXT,                   -- весь текст слайда
    key_phrases     TEXT[]                  -- ключевые фразы/тезисы
);

COMMENT ON TABLE slides IS 'Разобранное содержимое каждого слайда презентации';
COMMENT ON COLUMN slides.id IS 'Первичный ключ';
COMMENT ON COLUMN slides.presentation_id IS 'Ссылка на родительскую презентацию';
COMMENT ON COLUMN slides.slide_index IS 'Порядковый номер слайда (начиная с 1)';
COMMENT ON COLUMN slides.extracted_text IS 'Текст, автоматически извлечённый из слайда (может быть пустым)';
COMMENT ON COLUMN slides.key_phrases IS 'Массив ключевых тезисов, используемый для проверки покрытия';

-- Гарантирует, что в одной презентации не будет двух слайдов с одинаковым индексом
CREATE UNIQUE INDEX idx_slides_pres_slide ON slides(presentation_id, slide_index);
COMMENT ON INDEX idx_slides_pres_slide IS 'Уникальность номера слайда в рамках одной презентации';

-- ===========================
-- 4. Сессии репетиций
-- ===========================
CREATE TABLE practice_sessions (
    id              SERIAL PRIMARY KEY,
    user_id         INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    presentation_id INT NOT NULL REFERENCES presentations(id) ON DELETE CASCADE,
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ,
    duration_sec    INT,                    -- вычисляется автоматически
    time_limit_sec  INT NOT NULL,
    speech_engine   VARCHAR(20) DEFAULT 'web',
    audio_blob_path TEXT,
    status          VARCHAR(20) DEFAULT 'in_progress'
        CHECK (status IN ('in_progress','completed','interrupted'))
);

COMMENT ON TABLE practice_sessions IS 'Каждая попытка (тренировка) выступления';
COMMENT ON COLUMN practice_sessions.id IS 'Первичный ключ';
COMMENT ON COLUMN practice_sessions.user_id IS 'Студент, который выполняет попытку';
COMMENT ON COLUMN practice_sessions.presentation_id IS 'Презентация, по которой проходит репетиция';
COMMENT ON COLUMN practice_sessions.start_time IS 'Момент начала репетиции (UTC)';
COMMENT ON COLUMN practice_sessions.end_time IS 'Момент завершения репетиции (NULL, если ещё идёт)';
COMMENT ON COLUMN practice_sessions.duration_sec IS 'Фактическая длительность в секундах, вычисляется триггером';
COMMENT ON COLUMN practice_sessions.time_limit_sec IS 'Установленный регламент (например, 300 или 420 секунд)';
COMMENT ON COLUMN practice_sessions.speech_engine IS 'Использованный движок: web (Web Speech API) или vosk';
COMMENT ON COLUMN practice_sessions.audio_blob_path IS 'Ссылка на сохранённый аудиофайл (если сохраняем)';
COMMENT ON COLUMN practice_sessions.status IS 'Состояние: in_progress (идёт), completed (завершена), interrupted (прервана)';

CREATE INDEX idx_practice_sessions_user_id ON practice_sessions(user_id);
COMMENT ON INDEX idx_practice_sessions_user_id IS 'Ускоряет выборку сессий по студенту';

CREATE INDEX idx_practice_sessions_pres_id ON practice_sessions(presentation_id);
COMMENT ON INDEX idx_practice_sessions_pres_id IS 'Ускоряет выборку сессий по презентации';

-- ===========================
-- 5. Переключения слайдов (ручное листание студентом)
-- ===========================
CREATE TABLE slide_changes (
    id              SERIAL PRIMARY KEY,
    session_id      INT NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
    slide_index     INT NOT NULL,
    timestamp_offset_ms INT NOT NULL        -- миллисекунды от старта
);

COMMENT ON TABLE slide_changes IS 'Моменты смены слайда, зафиксированные клиентом во время репетиции';
COMMENT ON COLUMN slide_changes.id IS 'Первичный ключ';
COMMENT ON COLUMN slide_changes.session_id IS 'Сессия, к которой относится событие';
COMMENT ON COLUMN slide_changes.slide_index IS 'Номер слайда, на который перешли (начиная с 1)';
COMMENT ON COLUMN slide_changes.timestamp_offset_ms IS 'Время от начала сессии в миллисекундах';

CREATE INDEX idx_slide_changes_session_id ON slide_changes(session_id);
COMMENT ON INDEX idx_slide_changes_session_id IS 'Ускоряет получение всех переключений в рамках сессии';

-- ===========================
-- 6. Фрагменты распознанной речи (транскрипты)
-- ===========================
CREATE TABLE transcript_segments (
    id          SERIAL PRIMARY KEY,
    session_id  INT NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
    start_ms    INT NOT NULL,           -- начало в мс от старта сессии
    end_ms      INT NOT NULL,           -- конец в мс
    spoken_text TEXT NOT NULL           -- распознанный текст
);

COMMENT ON TABLE transcript_segments IS 'Отрезки распознанной речи с временными метками';
COMMENT ON COLUMN transcript_segments.id IS 'Первичный ключ';
COMMENT ON COLUMN transcript_segments.session_id IS 'Сессия, во время которой была произнесена фраза';
COMMENT ON COLUMN transcript_segments.start_ms IS 'Смещение начала фразы в миллисекундах от старта сессии';
COMMENT ON COLUMN transcript_segments.end_ms IS 'Смещение конца фразы в миллисекундах от старта сессии';
COMMENT ON COLUMN transcript_segments.spoken_text IS 'Текст, распознанный движком';

-- Индекс для быстрого получения транскриптов, упорядоченных по времени
CREATE INDEX idx_transcript_sessions_start ON transcript_segments(session_id, start_ms);
COMMENT ON INDEX idx_transcript_sessions_start IS 'Позволяет быстро извлекать речевые отрезки сессии в хронологическом порядке';

-- ===========================
-- 7. Постраничная обратная связь (покрытие тезисов по слайдам)
-- ===========================
CREATE TABLE session_slide_feedback (
    id              SERIAL PRIMARY KEY,
    session_id      INT NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
    slide_index     INT NOT NULL,
    coverage_score  FLOAT CHECK (coverage_score >= 0 AND coverage_score <= 1),
    matched_phrases TEXT[],
    missed_phrases  TEXT[],
    spoken_keywords TEXT[]
);

COMMENT ON TABLE session_slide_feedback IS 'Результат сравнения речи и ключевых тезисов для каждого слайда';
COMMENT ON COLUMN session_slide_feedback.id IS 'Первичный ключ';
COMMENT ON COLUMN session_slide_feedback.session_id IS 'Сессия репетиции';
COMMENT ON COLUMN session_slide_feedback.slide_index IS 'Номер слайда, к которому относится оценка';
COMMENT ON COLUMN session_slide_feedback.coverage_score IS 'Доля покрытых ключевых фраз (0.0 – ничего не сказано, 1.0 – все тезисы озвучены)';
COMMENT ON COLUMN session_slide_feedback.matched_phrases IS 'Какие из ключевых фраз были произнесены';
COMMENT ON COLUMN session_slide_feedback.missed_phrases IS 'Какие ключевые фразы отсутствовали в речи';
COMMENT ON COLUMN session_slide_feedback.spoken_keywords IS 'Все значимые слова, реально произнесённые на этом слайде';

-- Гарантирует не более одной оценки на пару (сессия, слайд)
CREATE UNIQUE INDEX idx_session_slide_feedback_uniq ON session_slide_feedback(session_id, slide_index);
COMMENT ON INDEX idx_session_slide_feedback_uniq IS 'Уникальность записи для каждого слайда в рамках одной сессии';

-- ===========================
-- 8. Итоговая сводка по сессии
-- ===========================
CREATE TABLE session_summary (
    session_id          INT PRIMARY KEY REFERENCES practice_sessions(id) ON DELETE CASCADE,
    timing_adherence    FLOAT,              -- 1.0 = уложился, меньше – превысил
    overall_coverage    FLOAT,              -- взвешенное покрытие (0..1)
    filler_word_count   INT DEFAULT 0,
    speech_rate_wpm     FLOAT,              -- слов в минуту
    suggestions         TEXT[],
    radar_data          JSONB DEFAULT '{}'::jsonb
);

COMMENT ON TABLE session_summary IS 'Агрегированные метрики и рекомендации по репетиции';
COMMENT ON COLUMN session_summary.session_id IS 'Ссылка на сессию (одна запись на одну сессию)';
COMMENT ON COLUMN session_summary.timing_adherence IS 'Коэффициент соблюдения регламента: 1.0 – точно в срок, <1 – превышение';
COMMENT ON COLUMN session_summary.overall_coverage IS 'Общая взвешенная оценка покрытия тезисов (например, 40% постраничный + 60% глобальный)';
COMMENT ON COLUMN session_summary.filler_word_count IS 'Обнаруженное количество слов-паразитов';
COMMENT ON COLUMN session_summary.speech_rate_wpm IS 'Средний темп речи (слов в минуту)';
COMMENT ON COLUMN session_summary.suggestions IS 'Текстовые рекомендации, сформированные системой';
COMMENT ON COLUMN session_summary.radar_data IS 'Данные для построения радарной диаграммы (чёткость, громкость, паузы и т.п.) в JSON';

-- ===========================
-- ТРИГГЕР для автоматического вычисления длительности сессии
-- ===========================
CREATE OR REPLACE FUNCTION calculate_duration()
RETURNS TRIGGER AS $$
BEGIN
    -- Если известны оба времени, вычисляем разность в секундах
    IF NEW.end_time IS NOT NULL AND NEW.start_time IS NOT NULL THEN
        NEW.duration_sec := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time))::INT;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_duration() IS 'Автоматически заполняет поле duration_sec при появлении end_time';

CREATE TRIGGER trg_practice_sessions_duration
    BEFORE INSERT OR UPDATE ON practice_sessions
    FOR EACH ROW
    EXECUTE FUNCTION calculate_duration();

COMMENT ON TRIGGER trg_practice_sessions_duration ON practice_sessions IS
'Вызывает функцию calculate_duration для автоматического расчёта фактической длительности тренировки';

-- ============================================================
-- ДОПОЛНИТЕЛЬНЫЕ ТРИГГЕРЫ И ХРАНИМЫЕ ФУНКЦИИ
-- для базы данных «Предзащита ВКР»
-- ============================================================

-- ============================================================
-- ТРИГГЕР 1
-- Автоматическое обновление slide_count в presentations
-- при добавлении или удалении слайдов
-- ============================================================

-- Функция, вызываемая триггером
CREATE OR REPLACE FUNCTION update_presentation_slide_count()
RETURNS TRIGGER AS $$
DECLARE
    affected_presentation_id INT;
BEGIN
    affected_presentation_id := CASE WHEN TG_OP = 'DELETE'
        THEN OLD.presentation_id ELSE NEW.presentation_id END;

    UPDATE presentations
    SET slide_count = (
        SELECT COUNT(*)::INT FROM slides
        WHERE presentation_id = affected_presentation_id
    )
    WHERE id = affected_presentation_id;

    -- Для AFTER-триггера возвращаемое значение игнорируется
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_presentation_slide_count() IS
'Автоматически поддерживает актуальное значение поля slide_count в таблице presentations
при добавлении (INSERT) или удалении (DELETE) записей в таблице slides.
Пересчитывает фактическое число слайдов после каждого изменения.';

-- Объявление самого триггера
CREATE TRIGGER trg_slides_count
    AFTER INSERT OR DELETE ON slides
    FOR EACH ROW
    EXECUTE FUNCTION update_presentation_slide_count();

COMMENT ON TRIGGER trg_slides_count ON slides IS
'Триггер AFTER INSERT OR DELETE.
На каждое добавление или удаление слайда автоматически корректирует
общее количество слайдов (slide_count) в родительской презентации.
Позволяет избежать ручного пересчёта и гарантирует согласованность данных.';


-- ============================================================
-- ТРИГГЕР 2
-- Валидация time_limit_sec в practice_sessions
-- Запрещает создание сессии с некорректным регламентом
-- ============================================================

-- Функция валидации
CREATE OR REPLACE FUNCTION validate_time_limit()
RETURNS TRIGGER AS $$
BEGIN
    -- Проверяем, что регламент находится в допустимых границах
    IF NEW.time_limit_sec < 60 OR NEW.time_limit_sec > 1800 THEN
        RAISE EXCEPTION
            'Некорректное время регламента: % секунд. Допустимый диапазон: от 60 до 1800 секунд (от 1 до 30 минут).',
            NEW.time_limit_sec;
    END IF;

    -- Валидация пройдена — разрешаем операцию
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_time_limit() IS
'Проверяет, что значение time_limit_sec находится в пределах от 60 до 1800 секунд.
Если значение вне диапазона — выбрасывает исключение и отменяет операцию.
Защищает от случайного или намеренного ввода некорректных данных.';

-- Объявление триггера
CREATE TRIGGER trg_validate_time_limit
    BEFORE INSERT OR UPDATE ON practice_sessions
    FOR EACH ROW
    EXECUTE FUNCTION validate_time_limit();

COMMENT ON TRIGGER trg_validate_time_limit ON practice_sessions IS
'Триггер BEFORE INSERT OR UPDATE.
Проверяет корректность поля time_limit_sec перед сохранением записи.
Диапазон допустимых значений: 60–1800 секунд (1–30 минут).
При нарушении выбрасывается исключение и операция отменяется.';


-- ============================================================
-- ТРИГГЕР 3
-- Проверка целостности slide_changes относительно презентации
-- Гарантирует, что переключаются только на существующие слайды
-- ============================================================

-- Функция проверки
CREATE OR REPLACE FUNCTION check_slide_change_index()
RETURNS TRIGGER AS $$
DECLARE
    max_slides INT;  -- общее количество слайдов в презентации
BEGIN
    -- Получаем количество слайдов презентации, связанной с текущей сессией
    SELECT p.slide_count INTO max_slides
    FROM practice_sessions s
    JOIN presentations p ON p.id = s.presentation_id
    WHERE s.id = NEW.session_id;

    -- Если номер слайда меньше 1 или больше максимального — ошибка
    IF NEW.slide_index < 1 OR NEW.slide_index > max_slides THEN
        RAISE EXCEPTION
            'Некорректный номер слайда: %. Презентация содержит % слайдов. Допустимый диапазон: 1–%.',
            NEW.slide_index, max_slides, max_slides;
    END IF;

    -- Проверка пройдена
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_slide_change_index() IS
'Проверяет, что при переключении слайда указывается индекс,
не превышающий общее количество слайдов в презентации.
Запрашивает slide_count из presentations через practice_sessions.
При выходе за границы выбрасывает исключение с указанием допустимого диапазона.';

-- Объявление триггера
CREATE TRIGGER trg_check_slide_change_index
    BEFORE INSERT OR UPDATE ON slide_changes
    FOR EACH ROW
    EXECUTE FUNCTION check_slide_change_index();

COMMENT ON TRIGGER trg_check_slide_change_index ON slide_changes IS
'Триггер BEFORE INSERT OR UPDATE.
Перед сохранением события переключения слайда проверяет,
что указанный slide_index не выходит за пределы количества слайдов
в соответствующей презентации.
Предотвращает появление некорректных ссылок на несуществующие слайды.';


-- ============================================================
-- ТРИГГЕР 4
-- Автоматическая инициализация session_summary при завершении сессии
-- Создаёт черновую запись в таблице итоговых сводок
-- ============================================================

-- Функция инициализации
CREATE OR REPLACE FUNCTION init_session_summary()
RETURNS TRIGGER AS $$
BEGIN
    -- Реагируем только на смену статуса с in_progress на completed
    IF NEW.status = 'completed' AND OLD.status = 'in_progress' THEN
        -- Вставляем пустую запись в сводку, если её ещё нет
        INSERT INTO session_summary (session_id)
        VALUES (NEW.id)
        ON CONFLICT (session_id) DO NOTHING;
    END IF;

    -- Возвращаем новую версию строки без изменений
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION init_session_summary() IS
'Автоматически создаёт запись в таблице session_summary при завершении репетиции.
Срабатывает только при переходе статуса practice_sessions из in_progress в completed.
Использует ON CONFLICT DO NOTHING для безопасного повторного вызова.
Создаёт черновую запись, которую позже заполнит бэкенд результатами анализа.';

-- Объявление триггера
CREATE TRIGGER trg_init_session_summary
    AFTER UPDATE ON practice_sessions
    FOR EACH ROW
    EXECUTE FUNCTION init_session_summary();

COMMENT ON TRIGGER trg_init_session_summary ON practice_sessions IS
'Триггер AFTER UPDATE.
Отслеживает изменение статуса репетиции.
При переходе от in_progress к completed автоматически создаёт
заготовку записи в session_summary для последующего заполнения аналитикой.
Упрощает логику приложения: можно сразу делать UPDATE, а не UPSERT.';


-- ============================================================
-- ХРАНИМАЯ ФУНКЦИЯ 1
-- Получение истории тренировок пользователя для дашборда
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_training_history(p_user_id INT)
RETURNS TABLE (
    session_id          INT,              -- идентификатор сессии
    presentation_title  TEXT,             -- название презентации
    start_time          TIMESTAMPTZ,      -- дата и время начала
    duration_sec        INT,              -- фактическая длительность
    time_limit_sec      INT,              -- установленный регламент
    timing_adherence    FLOAT,            -- соблюдение регламента (1.0 — идеально)
    overall_coverage    FLOAT,            -- общее покрытие ключевых тезисов
    filler_word_count   INT,              -- количество слов-паразитов
    speech_rate_wpm     FLOAT             -- темп речи (слов в минуту)
) AS $$
BEGIN
    -- Возвращаем агрегированные данные по всем завершённым сессиям пользователя
    RETURN QUERY
    SELECT
        ps.id,
        pr.title,
        ps.start_time,
        ps.duration_sec,
        ps.time_limit_sec,
        ss.timing_adherence,
        ss.overall_coverage,
        ss.filler_word_count,
        ss.speech_rate_wpm
    FROM practice_sessions ps
    -- Присоединяем презентацию для получения названия
    JOIN presentations pr ON pr.id = ps.presentation_id
    -- LEFT JOIN — на случай, если сводка ещё не заполнена
    LEFT JOIN session_summary ss ON ss.session_id = ps.id
    WHERE ps.user_id = p_user_id
      AND ps.status = 'completed'
    ORDER BY ps.start_time DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_training_history(INT) IS
'Возвращает историю всех завершённых тренировок указанного пользователя
для отображения на дашборде.
Входной параметр: p_user_id — идентификатор пользователя.
Результирующая таблица содержит все ключевые метрики:
название презентации, дату, длительность, регламент,
соблюдение времени, покрытие тезисов, слова-паразиты и темп речи.
Результаты отсортированы по дате от новых к старым.';


-- ============================================================
-- ХРАНИМАЯ ФУНКЦИЯ 2
-- Пакетная атомарная вставка фрагментов транскрипта
-- Принимает JSON-массив и вставляет все сегменты одной операцией
-- ============================================================

CREATE OR REPLACE FUNCTION insert_transcript_batch(
    p_session_id INT,     -- идентификатор сессии
    p_segments   JSONB    -- массив объектов [{start_ms, end_ms, spoken_text}, ...]
) RETURNS VOID AS $$
BEGIN
    -- Вставляем все сегменты одной атомарной операцией
    INSERT INTO transcript_segments (session_id, start_ms, end_ms, spoken_text)
    SELECT
        p_session_id,
        (seg->>'start_ms')::INT,       -- извлекаем начало фрагмента (мс)
        (seg->>'end_ms')::INT,         -- извлекаем конец фрагмента (мс)
        seg->>'spoken_text'            -- извлекаем распознанный текст
    FROM jsonb_array_elements(p_segments) AS seg;

    -- Если массив пустой — ошибки не будет, просто ничего не вставится
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION insert_transcript_batch(INT, JSONB) IS
'Выполняет атомарную вставку массива фрагментов распознанной речи.
Входные параметры:
  p_session_id — идентификатор сессии, к которой относятся транскрипты;
  p_segments   — JSONB-массив объектов с полями start_ms (INT), end_ms (INT),
                 spoken_text (TEXT).
Пример входных данных:
  [
    {"start_ms": 0,    "end_ms": 1200, "spoken_text": "Здравствуйте, уважаемые"},
    {"start_ms": 1500, "end_ms": 3200, "spoken_text": "члены комиссии"}
  ]
Все сегменты вставляются в рамках одной транзакции, что гарантирует
целостность данных и исключает частичную вставку при сбоях.';


-- ============================================================
-- ХРАНИМАЯ ФУНКЦИЯ 3
-- Определение активного слайда по временной метке внутри сессии
-- Используется для привязки речи к конкретным слайдам
-- ============================================================

CREATE OR REPLACE FUNCTION get_slide_by_offset(
    p_session_id INT,    -- идентификатор сессии
    p_offset_ms  INT     -- смещение от начала сессии в миллисекундах
) RETURNS INT AS $$
DECLARE
    result_slide INT;    -- номер определённого слайда
BEGIN
    -- Находим последнее переключение слайда, произошедшее до или в момент указанного смещения
    SELECT slide_index INTO result_slide
    FROM slide_changes
    WHERE session_id = p_session_id
      AND timestamp_offset_ms <= p_offset_ms
    ORDER BY timestamp_offset_ms DESC
    LIMIT 1;

    -- Если переключений ещё не было — значит, это первый слайд
    RETURN COALESCE(result_slide, 1);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_slide_by_offset(INT, INT) IS
'Определяет, какой слайд презентации был активен в указанный момент времени сессии.
Входные параметры:
  p_session_id — идентификатор сессии репетиции;
  p_offset_ms  — временна́я метка в миллисекундах от начала сессии.
Алгоритм:
  Находит последнее событие переключения слайда, произошедшее не позже p_offset_ms.
  Если ни одного переключения ещё не было — возвращает 1 (первый слайд).
Используется для привязки фрагментов транскрипта к конкретным слайдам
при последующем анализе покрытия ключевых тезисов.';


-- ============================================================
-- ХРАНИМАЯ ФУНКЦИЯ 4 (дополнительная, рекомендуется)
-- Получение детального отчёта по конкретной сессии
-- Возвращает постраничную обратную связь и общую сводку
-- ============================================================

CREATE OR REPLACE FUNCTION get_session_report(p_session_id INT)
RETURNS TABLE (
    -- Общая информация
    presentation_title  TEXT,
    start_time          TIMESTAMPTZ,
    duration_sec        INT,
    time_limit_sec      INT,
    timing_adherence    FLOAT,

    -- Постраничная обратная связь
    slide_index         INT,
    coverage_score      FLOAT,
    matched_phrases     TEXT[],
    missed_phrases      TEXT[],
    spoken_keywords     TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pr.title,
        ps.start_time,
        ps.duration_sec,
        ps.time_limit_sec,
        ss.timing_adherence,
        sf.slide_index,
        sf.coverage_score,
        sf.matched_phrases,
        sf.missed_phrases,
        sf.spoken_keywords
    FROM practice_sessions ps
    JOIN presentations pr ON pr.id = ps.presentation_id
    LEFT JOIN session_summary ss ON ss.session_id = ps.id
    LEFT JOIN session_slide_feedback sf ON sf.session_id = ps.id
    WHERE ps.id = p_session_id
    ORDER BY sf.slide_index;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_session_report(INT) IS
'Возвращает детальный отчёт по указанной сессии репетиции.
Входной параметр: p_session_id — идентификатор сессии.
Объединяет данные из:
  - presentations (название презентации),
  - practice_sessions (время, длительность, регламент),
  - session_summary (соблюдение времени),
  - session_slide_feedback (постраничный анализ покрытия).
Результат содержит одну строку на каждый слайд с оценками покрытия,
а также общую информацию, повторяющуюся в каждой строке.
Для получения только общей информации использовать get_user_training_history.';
