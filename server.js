const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Конфигурация
const PORT = process.env.PORT || 3000;

// Статика для фронтенда
app.use(express.static(__dirname));
app.use(express.json());

// Хранение клиентов
const clients = new Set();
let broadcaster = null;

// Основные маршруты
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/studio', (req, res) => {
    res.sendFile(path.join(__dirname, 'studio.html'));
});

app.get('/broadcaster', (req, res) => {
    res.sendFile(path.join(__dirname, 'broadcaster.html'));
});

app.get('/status', (req, res) => {
    res.json({
        status: 'online',
        broadcasterConnected: !!broadcaster,
        listeners: clients.size,
        uptime: process.uptime()
    });
});

// WebSocket обработка
wss.on('connection', (ws, req) => {
    console.log('Новое WebSocket соединение');
    
    ws.on('message', (message) => {
        try {
            // Если это бинарные данные (аудио)
            if (message instanceof Buffer) {
                // Рассылаем всем слушателям
                clients.forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(message);
                    }
                });
                
                // Логируем размер аудио данных
console.log(Аудио данные: ${message.length} байт);
                return;
            }
            
            // Если это текстовое сообщение
            if (typeof message === 'string') {
                const data = JSON.parse(message);
                
                switch(data.type) {
                    case 'register-broadcaster':
                        broadcaster = ws;
                        console.log('🎤 Broadcaster зарегистрирован');
                        ws.send(JSON.stringify({ type: 'registered', role: 'broadcaster' }));
                        break;
                        
                    case 'register-listener':
                        clients.add(ws);
                        console.log('👂 Новый слушатель, всего:', clients.size);
                        ws.send(JSON.stringify({ 
                            type: 'registered', 
                            role: 'listener',
                            listenersCount: clients.size
                        }));
                        break;
                        
                    case 'chat-message':
                        // Рассылаем сообщение чата всем
                        const chatMessage = {
                            type: 'chat-message',
                            user: data.user || 'Аноним',
                            text: data.text,
                            timestamp: new Date().toISOString()
                        };
                        
                        clients.forEach(client => {
                            if (client.readyState === WebSocket.OPEN) {
                                client.send(JSON.stringify(chatMessage));
                            }
                        });
                        break;
                        
                    case 'track-info':
                        // Рассылаем информацию о треке
                        clients.forEach(client => {
                            if (client.readyState === WebSocket.OPEN) {
                                client.send(JSON.stringify({
                                    type: 'track-info',
                                    track: data.track,
                                    artist: data.artist,

duration: data.duration
                                }));
                            }
                        });
                        break;
                }
            }
        } catch (error) {
            console.error('Ошибка обработки сообщения:', error);
        }
    });
    
    ws.on('close', () => {
        console.log('Соединение закрыто');
        
        // Удаляем из клиентов
        clients.delete(ws);
        
        // Если отключился broadcaster
        if (ws === broadcaster) {
            broadcaster = null;
            console.log('🎤 Broadcaster отключился');
            
            // Уведомляем слушателей
            clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'broadcaster-offline',
                        message: 'Ведущий отключился'
                    }));
                }
            });
        }
        
        console.log('Осталось слушателей:', clients.size);
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket ошибка:', error);
    });
});

// API эндпоинты
app.get('/api/stats', (req, res) => {
    res.json({
        listeners: clients.size,
        broadcasterConnected: !!broadcaster,
        serverTime: new Date().toISOString(),
        memoryUsage: process.memoryUsage()
    });
});

app.post('/api/broadcast', (req, res) => {
    const { message } = req.body;
    
    if (!message) {
        return res.status(400).json({ error: 'Сообщение обязательно' });
    }
    
    // Отправляем системное сообщение всем
    const systemMessage = {
        type: 'system-message',
        message: message,
        timestamp: new Date().toISOString()
    };
    
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(systemMessage));
        }
    });
    
    res.json({ success: true, sentTo: clients.size });
});

// Запуск сервера
server.listen(PORT, () => {
    console.log(
    🎧 LynchFM Radio Server
    ==========================
    📡 HTTP:  http://localhost:${PORT}
    📡 HTTPS: https://lynchfm-backend.onrender.com
    🎙️  Студия: /studio
    📻 Слушатели: /
    📊 Статус: /status
    ==========================
    Сервер запущен на порту ${PORT}
    );
});

// Обработка завершения
process.on('SIGINT', () => {
    console.log('Завершение работы сервера...');
    
    // Закрываем все соединения
    wss.clients.forEach(client => {
        client.close();
    });
    
    server.close(() => {
        console.log('Сервер остановлен');
        process.exit(0);
    });
});
