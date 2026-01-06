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
app.use(express.static(__dirname));

// Главная страница для слушателей
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// Студия для ведущего
app.get("/studio", (req, res) => {
    res.sendFile(path.join(__dirname, "studio.html"));
});

// Простой статус
app.get("/status", (req, res) => {
    res.json({ 
        status: "online", 
        broadcaster: !!broadcaster,
        listeners: clients.size,
        time: new Date().toISOString() 
    });
});

// WebSocket обработчик
wss.on("connection", (ws) => {
    console.log("✅ Новое WebSocket соединение");
    
    ws.on("message", (message) => {
        try {
            // Если это бинарные данные (аудио)
            if (message instanceof Buffer || message instanceof ArrayBuffer) {
                const data = Buffer.from(message);
                console.log(`📊 Аудио данные: ${data.length} байт`);
                
                // Рассылаем всем слушателям
                clients.forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(data);
                    }
                });
                return;
            }
            
            // Если это текстовое сообщение
            if (typeof message === "string") {
                const data = JSON.parse(message);
                console.log(`📨 Сообщение: ${data.type || "unknown"}`);
                
                switch(data.type) {
                    case "register-broadcaster":
                        broadcaster = ws;
                        console.log("🎤 Broadcaster зарегистрирован");
                        ws.send(JSON.stringify({ type: "registered", role: "broadcaster" }));
                        break;
                        
                    case "register-listener":
                        clients.add(ws);
                        console.log("👂 Новый слушатель, всего:", clients.size);
                        ws.send(JSON.stringify({ 
                            type: "registered", 
                            role: "listener",
                            listenersCount: clients.size
                        }));
                        break;
                        
                    case "ping":
                        ws.send(JSON.stringify({ type: "pong", time: Date.now() }));
                        break;
                }
            }
        } catch (error) {
            console.error("❌ Ошибка обработки сообщения:", error);
        }
    });
    
    ws.on("close", () => {
        console.log("🔌 Соединение закрыто");
        
        // Удаляем из клиентов
        clients.delete(ws);
        
        // Если отключился broadcaster
        if (ws === broadcaster) {
            broadcaster = null;
            console.log("🎤 Broadcaster отключился");
            
            // Уведомляем слушателей
            clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: "broadcaster-offline",
                        message: "Ведущий отключился"
                    }));
                }
            });
        }
        
        console.log("👥 Осталось слушателей:", clients.size);
    });
    
    ws.on("error", (error) => {
        console.error("⚠️ WebSocket ошибка:", error);
    });
});

// Запуск сервера
server.listen(PORT, () => {
    console.log("=========================================");
    console.log(`🚀 LynchFM Radio Server запущен!`);
    console.log(`📡 Порт: ${PORT}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`🎙️ Студия: http://localhost:${PORT}/studio`);
    console.log(`📻 Слушатели: http://localhost:${PORT}/`);
    console.log(`=========================================`);
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
