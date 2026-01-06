const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ 
    server,
    maxPayload: 10485760 // 10MB максимум для аудио
});

const PORT = process.env.PORT || 3000;
const clients = new Set();
let broadcaster = null;

// Раздаем статические файлы
app.use(express.static(path.join(__dirname, "public")));

// Главная страница
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Студия (доступ только по прямому URL)
app.get("/studio", (req, res) => {
    res.sendFile(path.join(__dirname, "studio.html"));
});

// Статус сервера
app.get("/status", (req, res) => {
    res.json({
        status: "online",
        broadcaster: !!broadcaster,
        listeners: clients.size - (broadcaster ? 1 : 0),
        time: new Date().toISOString()
    });
});

// WebSocket сервер
wss.on("connection", (ws) => {
    console.log("Новый клиент подключился");
    clients.add(ws);

    ws.on("message", (data) => {
        // Аудио данные
        if (data instanceof Buffer) {
            // Отправляем всем слушателям
            clients.forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(data);
                }
            });
            return;
        }
        
        // ArrayBuffer тоже поддерживаем
        if (data instanceof ArrayBuffer) {
            const buffer = Buffer.from(data);
            clients.forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(buffer);
                }
            });
            return;
        }

        // Текстовые сообщения
        if (typeof data === "string") {
            try {
                const msg = JSON.parse(data);
                
                if (msg.type === "register-broadcaster") {
                    broadcaster = ws;
                    console.log("Ведущий зарегистрирован");
                    ws.send(JSON.stringify({ type: "registered", role: "broadcaster" }));
                    
                    // Отправляем количество слушателей
                    const listenersCount = clients.size - 1;
                    ws.send(JSON.stringify({ type: "listeners", count: listenersCount }));
                }
                
                if (msg.type === "register-listener") {
                    console.log("Новый слушатель. Всего слушателей:", clients.size - (broadcaster ? 1 : 0));
                    ws.send(JSON.stringify({ type: "registered", role: "listener" }));
                    
                    // Отправляем количество слушателей всем
                    const listenersCount = clients.size - (broadcaster ? 1 : 0);
                    clients.forEach(client => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({ type: "listeners", count: listenersCount }));
                        }
                    });
                }
                
            } catch (error) {
                console.log("Ошибка парсинга:", error);
            }
        }
    });

    ws.on("close", () => {
        console.log("Клиент отключился");
        clients.delete(ws);
        
        if (ws === broadcaster) {
            broadcaster = null;
            console.log("Ведущий отключился");
        }
        
        // Обновляем счетчик слушателей
        const listenersCount = clients.size - (broadcaster ? 1 : 0);
        clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: "listeners", count: listenersCount }));
            }
        });
    });

    ws.on("error", (error) => {
        console.log("WebSocket ошибка:", error);
    });
});

// Запуск сервера
server.listen(PORT, () => {
    console.log("========================================");
    console.log("LynchFM Radio Server запущен!");
    console.log("Порт:", PORT);
    console.log("Сайт: https://lynchfm-backend.onrender.com");
    console.log("Студия: https://lynchfm-backend.onrender.com/studio");
    console.log("========================================");
});

// Graceful shutdown
process.on("SIGINT", () => {
    console.log("Остановка сервера...");
    wss.clients.forEach(client => client.close());
    server.close(() => {
        console.log("Сервер остановлен");
        process.exit(0);
    });
});
