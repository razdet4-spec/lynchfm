const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(express.static('public'));

// Маршрут для студии
app.get('/studio', (req, res) => {
    res.sendFile(path.join(__dirname, 'studio.html'));
});

// Хранилище для слушателей
let listeners = 0;

io.on('connection', (socket) => {
    listeners++;
    io.emit('listeners-count', listeners);
    console.log('Новый слушатель подключен. Всего:', listeners);

    // Принимаем поток от диджея (студии)
    socket.on('audio-stream', (data) => {
        // Рассылаем аудио всем, кроме самого диджея
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
