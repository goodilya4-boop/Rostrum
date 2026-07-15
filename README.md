# Трибуна / Rostrum

Rostrum помогает репетировать защиту проекта. Пользователь загружает презентацию, выступает с микрофоном и получает отчёт по времени, темпу речи, словам-паразитам и содержанию доклада.

## Что работает

- регистрация и вход;
- загрузка презентаций PPTX и PDF;
- показ слайдов;
- репетиция с таймером;
- распознавание речи через Web Speech;
- анализ выступления и страница результатов;
- профиль и настройки.

Vosk пока находится в разработке и отключён.

## Что находится в проекте

- `Rostrum-Backend` — сервер, база данных и анализ;
- `Rostrum-Frontend` — пользовательский интерфейс;
- `Rostrum-Backend/vosk-service` — незаконченная заготовка Vosk.

## Как запустить

Нужны Node.js 18+, npm и PostgreSQL.

Сначала запустите Backend:

```powershell
cd Rostrum-Backend
npm install
Copy-Item .env.example .env
npm run migrate
npm run dev
```

Перед миграцией создайте пустую базу PostgreSQL и укажите данные подключения в `.env`.

Затем откройте второй терминал и запустите Frontend:

```powershell
cd Rostrum-Frontend
npm install
npm run dev
```

Приложение откроется по адресу http://localhost:5173. Для распознавания речи лучше использовать Microsoft Edge и разрешить доступ к микрофону.

## Тесты

```powershell
cd Rostrum-Backend
npm test
```

```powershell
cd Rostrum-Frontend
npm test
npm run build
```

Более подробные команды есть в README внутри папок Backend и Frontend.
