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

app.use(express.static(__dirname));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/studio", (req, res) => {
    res.sendFile(path.join(__dirname, "studio.html"));
});

app.get("/status", (req, res) => {
    res.json({
        status: "online",
        broadcasterConnected: !!broadcaster,
        listeners: clients.size,
    });
});

wss.on("connection", (ws) => {
    console.log("Новое соединение");

    ws.on("message", (message) => {
        if (message instanceof Buffer) {
            // ВОТ ТУТ БЫЛА ОШИБКА - исправлено:
            console.log(Аудио данные: ${message.length} байт);
            
            clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });
            return;
        }

        if (typeof message === "string") {
            const data = JSON.parse(message);
            if (data.type === "register-broadcaster") {
                broadcaster = ws;
                console.log("🎤 Broadcaster подключен");
                ws.send(JSON.stringify({ type: "registered", role: "broadcaster" }));
            } else if (data.type === "register-listener") {
                clients.add(ws);
                console.log("👂 Слушатель добавлен, всего:", clients.size);
                ws.send(JSON.stringify({ type: "registered", role: "listener" }));
            }
        }
    });

    ws.on("close", () => {
        clients.delete(ws);
        if (ws === broadcaster) {
            broadcaster = null;
            console.log("🎤 Broadcaster отключился");
        }
        console.log("Осталось слушателей:", clients.size);
    });
});

server.listen(PORT, () => {
    console.log(🚀 Сервер запущен на порту ${PORT});
    console.log(🎙️ Студия: http://localhost:${PORT}/studio);
    console.log(📻 Радио: http://localhost:${PORT}/);
});
