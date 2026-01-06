const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const clients = new Set(); // Храним всех подключенных
let broadcaster = null;    // Ведущий трансляции

// Раздаем статику из public
app.use(express.static(path.join(__dirname, "public")));

// Главная страница
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Студия
app.get("/studio", (req, res) => {
    res.sendFile(path.join(__dirname, "studio.html"));
});

// Статус с количеством пользователей
app.get("/status", (req, res) => {
    res.json({
        status: "online",
        listeners: clients.size,
        broadcaster: !!broadcaster,
        time: new Date().toISOString()
    });
});

// WebSocket обработка
wss.on("connection", (ws) => {
    console.log("Новое подключение. Всего клиентов:", clients.size + 1);
    
    // Добавляем клиента
    clients.add(ws);
    
    ws.on("message", (data) => {
        // Бинарные данные (аудио) - пересылаем всем слушателям
        if (data instanceof Buffer || data instanceof ArrayBuffer) {
            clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(data);
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
                    ws.send(JSON.stringify({ 
                        type: "registered", 
                        role: "broadcaster",
                        listeners: clients.size - 1
                    }));
                }
                
                if (msg.type === "register-listener") {
                    console.log("Новый слушатель. Всего:", clients.size);
                    ws.send(JSON.stringify({ 
                        type: "registered", 
                        role: "listener",
                        listeners: clients.size
                    }));
                    
                    // Обновляем счетчик у всех
                    broadcastListenersCount();
                }
            } catch (e) {
                console.log("Ошибка парсинга сообщения:", e);
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
        
        broadcastListenersCount();
    });
});

// Функция для рассылки количества слушателей
function broadcastListenersCount() {
    const count = clients.size - (broadcaster ? 1 : 0);
    const message = JSON.stringify({ 
        type: "listeners", 
        count: count 
    });
    
    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Запуск сервера
server.listen(PORT, () => {
    console.log("========================================");
    console.log("🎧 LynchFM Radio Server запущен!");
    console.log("📡 Порт:", PORT);
    console.log("👥 Макс. клиентов:", wss.options.maxListeners || "не ограничено");
    console.log("========================================");
});
