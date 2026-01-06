const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const clients = new Set();
let broadcaster = null;

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
    console.log("Новый клиент подключился. Всего:", clients.size + 1);
    clients.add(ws);

    ws.on("message", (message) => {
        // Аудио данные
        if (message instanceof Buffer || message instanceof ArrayBuffer) {
            // Отправляем всем слушателям
            clients.forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });
            return;
        }

        // Текстовые сообщения
        if (typeof message === "string") {
            try {
                const data = JSON.parse(message);
                
                if (data.type === "register-broadcaster") {
                    broadcaster = ws;
                    console.log("Ведущий зарегистрирован");
                    ws.send(JSON.stringify({ type: "registered", role: "broadcaster" }));
                    
                    // Отправляем количество слушателей
                    const listenersCount = clients.size - 1;
                    ws.send(JSON.stringify({ type: "listeners", count: listenersCount }));
                }
                
                if (data.type === "register-listener") {
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
                
                if (data.type === "track-info") {
                    // Пересылаем информацию о треке всем слушателям
                    clients.forEach(client => {
                        if (client !== ws && client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({
                                type: "track-info",
                                title: data.title,
                                artist: data.artist
                            }));
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
