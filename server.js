const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Проверяем существование файлов
console.log("Проверка файлов:");
console.log("index.html существует:", fs.existsSync(path.join(__dirname, "public", "index.html")));
console.log("studio.html существует:", fs.existsSync(path.join(__dirname, "studio.html")));

// Раздаем статические файлы из папки public
app.use(express.static(path.join(__dirname, "public")));

// Главная страница - index.html из папки public
app.get("/", (req, res) => {
    const indexPath = path.join(__dirname, "public", "index.html");
    console.log("Запрос /, отправляем:", indexPath);
    res.sendFile(indexPath);
});

// Студия для ведущего - studio.html из корня
app.get("/studio", (req, res) => {
    const studioPath = path.join(__dirname, "studio.html");
    console.log("Запрос /studio, отправляем:", studioPath);
    res.sendFile(studioPath);
});

// API эндпоинты
app.get("/status", (req, res) => {
    res.json({ 
        status: "online", 
        time: new Date().toISOString(),
        files: {
            index: fs.existsSync(path.join(__dirname, "public", "index.html")),
            studio: fs.existsSync(path.join(__dirname, "studio.html"))
        }
    });
});

// WebSocket обработчик
wss.on("connection", (ws) => {
    console.log("✅ Новое WebSocket соединение");
    
    ws.on("message", (message) => {
        // Если это бинарные данные (аудио)
        if (message instanceof Buffer || message instanceof ArrayBuffer) {
            // Пересылаем всем другим клиентам
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });
            return;
        }
        
        // Если это текстовое сообщение
        if (typeof message === "string") {
            console.log(📨 Сообщение от клиента: ${message.substring(0, 100)});
            
            try {
                const data = JSON.parse(message);
                if (data.type === "register-broadcaster") {
                    console.log("🎤 Broadcaster зарегистрирован");
                    ws.send(JSON.stringify({ type: "registered", role: "broadcaster" }));
                }
                if (data.type === "register-listener") {
                    console.log("👂 Новый слушатель");
                    ws.send(JSON.stringify({ type: "registered", role: "listener" }));
                }
            } catch (e) {
                // Игнорируем ошибки парсинга
            }
        }
    });
    
    ws.on("close", () => {
        console.log("🔌 Соединение закрыто");
    });
    
    ws.on("error", (error) => {
        console.error("⚠️ WebSocket ошибка:", error);
    });
});

// Обработка ошибок 404
app.use((req, res) => {
    res.status(404).send("Страница не найдена");
});

// Запуск сервера
server.listen(PORT, () => {
    console.log("=========================================");
    console.log(🚀 LynchFM Radio Server запущен!);
    console.log(📡 Порт: ${PORT});
    console.log(🌐 URL: http://localhost:${PORT});
    console.log(🎙️ Студия: http://localhost:${PORT}/studio);
    console.log(📻 Слушатели: http://localhost:${PORT}/);
    console.log("=========================================");
});

// Graceful shutdown
process.on("SIGINT", () => {
    console.log("\n🛑 Остановка сервера...");
    wss.clients.forEach(client => client.close());
    server.close(() => {
        console.log("✅ Сервер остановлен");
        process.exit(0);
    });
});
