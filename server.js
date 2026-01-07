const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" },
    maxHttpBufferSize: 1e7 // Увеличиваем буфер для стабильной передачи
});

app.use(express.static('public'));

// Маршруты
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/studio', (req, res) => res.sendFile(path.join(__dirname, 'studio.html')));

let listeners = 0;

io.on('connection', (socket) => {
    listeners++;
    io.emit('listeners-count', listeners);

    // Пересылка аудио потока
    socket.on('audio-stream', (data) => {
        socket.broadcast.emit('audio-data', data);
    });

    socket.on('disconnect', () => {
        listeners--;
        io.emit('listeners-count', listeners);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(LynchFM запущена на порту ${PORT});
});
