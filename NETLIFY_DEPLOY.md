# 🚀 Деплой LynchFM на Netlify

## ⚠️ Важная информация о Netlify

**Netlify НЕ поддерживает WebSocket/Socket.io напрямую!**

Но мы можем сделать так:
- **Frontend (сайт) на Netlify** - красивая страница
- **Backend (сервер) на Render/Railway** - для Socket.io и трансляции

Это лучший вариант! Давайте настроим оба сервиса.

---

## 📦 Вариант 1: Только Frontend на Netlify (ОГРАНИЧЕННЫЙ)

Если хотите только статический сайт (БЕЗ трансляции):

### Шаг 1: Подготовка файлов

Создайте папку для Netlify деплоя:

```bash
# Создайте папку netlify-deploy
mkdir netlify-deploy
cd netlify-deploy
```

Скопируйте файлы:
- `public/index.html`
- `public/style.css`
- `public/app.js`

### Шаг 2: Настройка для Netlify

Создайте файл `netlify.toml`:

```toml
[build]
  publish = "public"
  
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Шаг 3: Деплой на Netlify

1. Зарегистрируйтесь на https://netlify.com
2. Нажмите "Add new site" → "Deploy manually"
3. Перетащите папку `public` в окно браузера
4. Готово! Сайт задеплоен

**⚠️ Но трансляция НЕ будет работать!** Нужен отдельный сервер.

---

## ✅ Вариант 2: РЕКОМЕНДУЕТСЯ - Frontend + Backend

### Часть A: Backend на Render.com (для Socket.io)

1. **Загрузите весь проект на GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Deploy to Render"
   git remote add origin https://github.com/ВАШ_ЛОГИН/lynchfm.git
   git push -u origin main
   ```

2. **Деплой на Render:**
   - Зайдите на https://render.com
   - New → Web Service
   - Подключите GitHub репозиторий
   - Настройки:
     ```
     Name: lynchfm-backend
     Build Command: npm install
     Start Command: npm start
     Environment: Node
     ```
   - Environment Variables:
     ```
     NODE_ENV=production
     PORT=10000
     HOST=0.0.0.0
     ALLOWED_ORIGINS=https://your-netlify-site.netlify.app
     ```
   - Создайте сервис
   - Скопируйте URL (например: `https://lynchfm-backend.onrender.com`)

### Часть B: Frontend на Netlify (с подключением к Render)

1. **Создайте папку для деплоя:**
   ```bash
   mkdir netlify-frontend
   cd netlify-frontend
   ```

2. **Скопируйте файлы из `public/`:**
   - `index.html`
   - `style.css`
   - `app.js`

3. **Измените `app.js` - укажите URL Render сервера:**

   Найдите строку:
   ```javascript
   const socket = io();
   ```

   Замените на:
   ```javascript
   const socket = io('https://lynchfm-backend.onrender.com');
   ```
   (Используйте ваш URL с Render!)

4. **Создайте `netlify.toml`:**
   ```toml
   [build]
     publish = "."
   
   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200
   ```

5. **Деплой на Netlify:**
   - Зайдите на https://netlify.com
   - "Add new site" → "Deploy manually"
   - Перетащите папку с файлами
   - Готово!

6. **Обновите ALLOWED_ORIGINS на Render:**
   - Зайдите в настройки сервиса на Render
   - Environment → Edit
   - Измените `ALLOWED_ORIGINS` на ваш Netlify URL
   - Сохраните

---

## 🎯 Полный автоматический деплой (GitHub)

### Шаг 1: Подготовка

1. Создайте файл `public/app.js` (если его нет)
2. Найдите строку с `const socket = io();`
3. Замените на:
   ```javascript
   const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'https://lynchfm-backend.onrender.com';
   const socket = io(SERVER_URL);
   ```

### Шаг 2: Настройка для Netlify

Создайте файл `netlify.toml` в корне проекта:

```toml
[build]
  command = "echo 'No build needed'"
  publish = "public"
  
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[build.environment]
  REACT_APP_SERVER_URL = "https://lynchfm-backend.onrender.com"
```

### Шаг 3: Деплой через GitHub

1. Загрузите код на GitHub:
   ```bash
   git add .
   git commit -m "Netlify deploy"
   git push
   ```

2. На Netlify:
   - "Add new site" → "Import an existing project"
   - Подключите GitHub
   - Выберите репозиторий
   - Настройки:
     ```
     Build command: (оставьте пустым)
     Publish directory: public
     ```
   - "Deploy site"

3. Готово! Сайт работает!

---

## 🔧 Настройка CORS на Render

Убедитесь что на Render сервере разрешены запросы с Netlify:

В `server.js` должно быть:
```javascript
const io = socketIo(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});
```

---

## 📱 Проверка работы

1. Откройте ваш Netlify сайт
2. Откройте консоль браузера (F12)
3. Должны быть видны подключения к Socket.io
4. Если есть ошибки CORS - проверьте ALLOWED_ORIGINS

---

## 🎙️ Использование в программе Broadcaster

В программе Broadcaster введите URL Render сервера:
```
https://lynchfm-backend.onrender.com
```

НЕ используйте Netlify URL для трансляции - только Render!

---

## 🆘 Решение проблем

### Ошибка CORS:
- Проверьте ALLOWED_ORIGINS на Render
- Убедитесь что URL правильный (с https://)

### Socket.io не подключается:
- Проверьте что Render сервер запущен
- Проверьте URL в app.js
- Посмотрите логи на Render

### Сайт не загружается:
- Проверьте что папка `public` указана правильно
- Убедитесь что `index.html` в папке `public`

---

## 📝 Итоговая структура

```
lynchfm/
├── public/              # Frontend (деплоится на Netlify)
│   ├── index.html
│   ├── style.css
│   └── app.js          # С подключением к Render
├── server.js           # Backend (деплоится на Render)
├── package.json
└── netlify.toml        # Конфигурация Netlify
```

---

**Готово! Ваш сайт на Netlify, сервер на Render! 🎵**

