const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const clients = new Set();

// Раздаем статические файлы
app.use(express.static(path.join(__dirname, "public")));

// Главная страница
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Студия
app.get("/studio", (req, res) => {
    res.sendFile(path.join(__dirname, "studio.html"));
});

// WebSocket - ПРОСТО ПЕРЕСЫЛАЕМ ВСЕ
wss.on("connection", (ws) => {
    console.log("Клиент подключен");
    clients.add(ws);
    
    ws.on("message", (data) => {
        // ПРОСТО ПЕРЕСЫЛАЕМ ВСЕМ ОСТАЛЬНЫМ
        clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
        });
    });
    
    ws.on("close", () => {
        console.log("Клиент отключился");
        clients.delete(ws);
    });
});

// Запуск сервера
server.listen(PORT, () => {
    console.log(✅ Сервер запущен на порту ${PORT});
    console.log(📻 Слушатели: http://localhost:${PORT});
    console.log(🎙️ Студия: http://localhost:${PORT}/studio);
});
