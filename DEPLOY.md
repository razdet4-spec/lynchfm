# Руководство по развертыванию LynchFM

## Варианты развертывания

### 1. Развертывание на VPS сервере

#### Требования:
- Ubuntu 20.04+ или Debian 11+
- Node.js 18+
- Nginx (для проксирования)
- PM2 (для управления процессом)

#### Шаги:

1. **Подготовка сервера:**
```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Установка PM2
sudo npm install -g pm2

# Установка Nginx
sudo apt install -y nginx
```

2. **Клонирование и настройка проекта:**
```bash
# Клонируйте репозиторий
git clone <your-repo-url> lynchfm
cd lynchfm

# Установите зависимости
npm install

# Создайте .env файл
cp .env.example .env
nano .env
```

3. **Настройка .env:**
```env
PORT=3000
HOST=0.0.0.0
ALLOWED_ORIGINS=https://yourdomain.com
NODE_ENV=production
```

4. **Настройка Nginx:**
```bash
sudo nano /etc/nginx/sites-available/lynchfm
```

Добавьте конфигурацию:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Активируйте конфигурацию:
```bash
sudo ln -s /etc/nginx/sites-available/lynchfm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

5. **Установка SSL сертификата (Let's Encrypt):**
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

6. **Запуск приложения с PM2:**
```bash
pm2 start server.js --name lynchfm
pm2 save
pm2 startup
```

### 2. Развертывание с Docker

1. **Создайте .env файл:**
```bash
cp .env.example .env
```

2. **Запустите контейнер:**
```bash
docker-compose up -d
```

3. **Проверьте логи:**
```bash
docker-compose logs -f
```

### 3. Развертывание на Heroku

1. **Установите Heroku CLI**

2. **Создайте Procfile:**
```
web: node server.js
```

3. **Развертывание:**
```bash
heroku create lynchfm-radio
heroku config:set NODE_ENV=production
git push heroku main
```

### 4. Развертывание на Railway/Render

1. Подключите GitHub репозиторий
2. Установите переменные окружения:
   - `PORT` (автоматически)
   - `NODE_ENV=production`
   - `ALLOWED_ORIGINS=https://yourdomain.com`
3. Запустите деплой

## Настройка домена

1. **Добавьте A-запись в DNS:**
   - Тип: A
   - Имя: @ (или ваш поддомен)
   - Значение: IP адрес вашего сервера

2. **Добавьте CNAME для www:**
   - Тип: CNAME
   - Имя: www
   - Значение: yourdomain.com

3. **Подождите распространения DNS (до 24 часов)**

## Мониторинг и логи

### PM2:
```bash
pm2 status
pm2 logs lynchfm
pm2 monit
```

### Docker:
```bash
docker-compose logs -f
```

## Обновление приложения

```bash
git pull
npm install
pm2 restart lynchfm
# или
docker-compose restart
```

## Резервное копирование

Рекомендуется настроить автоматическое резервное копирование:
- Конфигурационные файлы
- Логи
- База данных (если используется)

## Безопасность

1. Настройте firewall:
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

2. Регулярно обновляйте зависимости:
```bash
npm audit
npm update
```

3. Используйте сильные пароли для SSH

4. Настройте fail2ban для защиты от брутфорса

