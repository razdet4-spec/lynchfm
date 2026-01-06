# ⚡ Быстрый деплой на Netlify за 3 шага

## ⚠️ ВАЖНО: Netlify не поддерживает Socket.io!

Для работы трансляции нужен отдельный сервер на **Render.com** или **Railway.app**.

---

## 🚀 Быстрый деплой (2 сервиса)

### Шаг 1: Backend на Render (2 минуты)

1. Загрузите код на GitHub:
   ```bash
   git init
   git add .
   git commit -m "Deploy"
   git remote add origin https://github.com/ВАШ_ЛОГИН/lynchfm.git
   git push -u origin main
   ```

2. На Render.com:
   - Зарегистрируйтесь на https://render.com
   - New → Web Service → подключите GitHub
   - Настройки:
     - Build: `npm install`
     - Start: `npm start`
   - Environment:
     - `NODE_ENV=production`
     - `PORT=10000`
     - `ALLOWED_ORIGINS=https://your-site.netlify.app` (пока что любое значение)
   - Create
   - Скопируйте URL (например: `https://lynchfm-backend.onrender.com`)

### Шаг 2: Обновите app.js с Render URL

Откройте `public/app.js` и найдите:
```javascript
const SERVER_URL = window.location.hostname === 'localhost' 
  ? '' 
  : 'https://lynchfm-backend.onrender.com'; // <-- ВСТАВЬТЕ ВАШ URL!
```

Замените `https://lynchfm-backend.onrender.com` на ваш URL с Render!

### Шаг 3: Frontend на Netlify (1 минута)

1. Зайдите на https://netlify.com
2. "Add new site" → "Deploy manually"
3. Перетащите папку `public` в окно браузера
4. Дождитесь деплоя (30 секунд)
5. Скопируйте URL (например: `https://lynchfm-radio.netlify.app`)

### Шаг 4: Обновите CORS на Render

1. Зайдите в настройки сервиса на Render
2. Environment → Edit
3. Измените `ALLOWED_ORIGINS` на ваш Netlify URL:
   ```
   ALLOWED_ORIGINS=https://lynchfm-radio.netlify.app
   ```
4. Save Changes
5. Подождите 1-2 минуты пока сервер перезапустится

---

## ✅ Готово!

- **Сайт:** https://lynchfm-radio.netlify.app
- **Сервер:** https://lynchfm-backend.onrender.com

Теперь:
1. Откройте сайт на телефоне/ПК
2. В программе Broadcaster введите Render URL
3. Начните трансляцию!

---

## 🔄 Автоматический деплой через GitHub

Если хотите чтобы при каждом `git push` автоматически деплоилось:

### Netlify:
1. На Netlify: "Add new site" → "Import an existing project"
2. Подключите GitHub
3. Выберите репозиторий
4. Настройки:
   - Build command: (оставьте пустым)
   - Publish directory: `public`
5. Deploy

### Render:
- Уже автоматически деплоится при push в main

---

## 🎙️ Использование

В программе Broadcaster:
- **URL сервера:** `https://lynchfm-backend.onrender.com` (ваш Render URL)
- НЕ используйте Netlify URL для трансляции!

На сайте:
- Откройте ваш Netlify URL
- Нажмите кнопку воспроизведения
- Слушайте радио!

---

**Всё готово! 🎵📻**

