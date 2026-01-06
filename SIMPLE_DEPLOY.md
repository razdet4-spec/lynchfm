# 🚀 Простой деплой на Render - БЕЗ ЗАМОРОЧЕК

## Шаг 1: Исправить команду в Render

1. Зайдите на https://render.com
2. Откройте ваш сервис `lynchfm-radio`
3. **Settings** → **Start Command**
4. Измените на: **`node server.js`**
5. **Save Changes**

ВСЁ! Render перезапустит сервис автоматически.

## Шаг 2: Скопировать URL

После успешного запуска скопируйте URL сервера (например: `https://lynchfm-radio.onrender.com`)

## Шаг 3: Обновить app.js

Откройте `public/app.js` и замените URL на ваш Render URL:

```javascript
const SERVER_URL = window.location.hostname === 'localhost' 
  ? '' 
  : 'https://lynchfm-radio.onrender.com'; // ВАШ URL!
```

## Шаг 4: Деплой на Netlify

1. Зайдите на https://netlify.com
2. **Add new site** → **Deploy manually**
3. Перетащите папку `public`
4. Готово!

## Шаг 5: Обновить CORS

В Render → Settings → Environment:
- Добавьте `ALLOWED_ORIGINS` = ваш Netlify URL

---

**ГОТОВО! Радиостанция работает! 🎵**

