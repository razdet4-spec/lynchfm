# Настройка продакшн сервера LynchFM

## 1. Выбор хостинга

### Рекомендуемые варианты:

**VPS (Virtual Private Server):**
- DigitalOcean ($5-10/месяц)
- Vultr ($5-10/месяц)
- Hetzner (€4-10/месяц)
- AWS EC2 (pay-as-you-go)

**Platform-as-a-Service:**
- Railway.app ($5-10/месяц)
- Render.com (бесплатный tier)
- Fly.io (бесплатный tier)
- Heroku ($7+/месяц)

## 2. Настройка VPS сервера (Ubuntu/Debian)

### Подключение к серверу:
```bash
ssh root@your-server-ip
```

### Обновление системы:
```bash
apt update && apt upgrade -y
```

### Установка Node.js 18+:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs
node --version
```

### Установка PM2:
```bash
npm install -g pm2
```

### Установка Nginx:
```bash
apt install -y nginx
```

### Установка Git:
```bash
apt install -y git
```

## 3. Развертывание приложения

### Клонирование репозитория:
```bash
cd /var/www
git clone <your-repo-url> lynchfm
cd lynchfm
```

### Установка зависимостей:
```bash
npm install --production
```

### Создание .env файла:
```bash
nano .env
```

Добавьте:
```env
PORT=3000
HOST=0.0.0.0
ALLOWED_ORIGINS=https://yourdomain.com
NODE_ENV=production
```

### Запуск с PM2:
```bash
pm2 start server.js --name lynchfm
pm2 save
pm2 startup
```

## 4. Настройка Nginx

Создайте конфигурацию:
```bash
nano /etc/nginx/sites-available/lynchfm
```

Добавьте:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Размер загрузки файлов
    client_max_body_size 10M;

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
        
        # Таймауты для WebSocket
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Таймауты
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

Активируйте:
```bash
ln -s /etc/nginx/sites-available/lynchfm /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

## 5. Настройка SSL (Let's Encrypt)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot автоматически обновит конфигурацию Nginx.

## 6. Настройка Firewall

```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

## 7. Настройка домена

### DNS записи:
- **A запись:** `@` → IP сервера
- **CNAME:** `www` → `yourdomain.com`

### Проверка:
```bash
dig yourdomain.com
nslookup yourdomain.com
```

## 8. Мониторинг

### PM2 мониторинг:
```bash
pm2 status
pm2 logs lynchfm
pm2 monit
```

### Автоматический перезапуск:
PM2 автоматически перезапускает приложение при сбоях.

## 9. Обновление приложения

```bash
cd /var/www/lynchfm
git pull
npm install --production
pm2 restart lynchfm
```

## 10. Резервное копирование

### Автоматический бэкап:
```bash
# Создайте скрипт бэкапа
nano /usr/local/bin/backup-lynchfm.sh
```

Добавьте:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf /backup/lynchfm_$DATE.tar.gz /var/www/lynchfm
find /backup -name "lynchfm_*.tar.gz" -mtime +7 -delete
```

### Настройка cron:
```bash
crontab -e
# Добавьте: 0 2 * * * /usr/local/bin/backup-lynchfm.sh
```

## Проблемы и решения

### Приложение не запускается:
```bash
pm2 logs lynchfm
# Проверьте ошибки
```

### Порт занят:
```bash
lsof -i :3000
kill -9 <PID>
```

### Nginx ошибки:
```bash
nginx -t
tail -f /var/log/nginx/error.log
```

## Производительность

### Увеличение лимитов:
```bash
nano /etc/systemd/system.conf
# Добавьте:
DefaultLimitNOFILE=65536
```

### Оптимизация Node.js:
В .env добавьте:
```env
NODE_OPTIONS=--max-old-space-size=2048
```

## Готово!

Ваша радиостанция теперь доступна на https://yourdomain.com

