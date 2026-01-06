// Загрузка переменных окружения
try {
    require('dotenv').config();
} catch (e) {
    console.warn('dotenv не установлен, используем переменные окружения системы');
}
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);

// Настройка Socket.io с улучшенной конфигурацией
const io = socketIo(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Безопасность
app.use(helmet({
  contentSecurityPolicy: false, // Отключаем для Socket.io
  crossOriginEmbedderPolicy: false
}));

// Сжатие
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100 // лимит запросов
});
app.use('/api/', limiter);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public', { maxAge: '1d' }));

// Хранилище данных
const stationData = {
  isLive: false,
  broadcaster: null,
  listeners: new Map(),
  currentTrack: {
    title: 'LynchFM',
    artist: '88.8 FM',
    cover: null
  },
  stats: {
    totalListeners: 0,
    peakListeners: 0,
    uptime: Date.now()
  },
  playlist: []
};

// API Routes
app.get('/api/status', (req, res) => {
  res.json({
    isLive: stationData.isLive,
    currentTrack: stationData.currentTrack,
    listeners: stationData.listeners.size,
    stats: {
      ...stationData.stats,
      uptime: Date.now() - stationData.stats.uptime
    }
  });
});

app.get('/api/stats', (req, res) => {
  res.json({
    listeners: stationData.listeners.size,
    peakListeners: stationData.stats.peakListeners,
    isLive: stationData.isLive,
    uptime: Date.now() - stationData.stats.uptime
  });
});

// Socket.io соединения
io.on('connection', (socket) => {
  console.log(`[${new Date().toISOString()}] Новое подключение: ${socket.id}`);

  // Диджей подключается к эфиру
  socket.on('broadcaster-connect', (data) => {
    if (stationData.broadcaster && stationData.broadcaster !== socket.id) {
      socket.emit('error', 'Уже есть активный диджей');
      return;
    }

    stationData.broadcaster = socket.id;
    stationData.isLive = true;
    if (!stationData.stats.uptime || stationData.stats.uptime === Date.now()) {
      stationData.stats.uptime = Date.now();
    }
    
    if (data?.track) {
      stationData.currentTrack = data.track;
    }

    // Отправляем всем о подключении диджея
    socket.broadcast.emit('broadcaster');
    socket.broadcast.emit('broadcaster-connected', {
      track: stationData.currentTrack
    });
    
    // Обновляем статус для всех
    io.emit('status-update', {
      isLive: true,
      track: stationData.currentTrack,
      listeners: stationData.listeners.size
    });

    console.log(`[${new Date().toISOString()}] Диджей подключен: ${socket.id}`);
  });

  // Слушатель подключается
  socket.on('listener-connect', () => {
    stationData.listeners.set(socket.id, {
      connectedAt: Date.now(),
      ip: socket.handshake.address
    });

    // Обновляем пиковое количество слушателей
    if (stationData.listeners.size > stationData.stats.peakListeners) {
      stationData.stats.peakListeners = stationData.listeners.size;
    }

    socket.emit('listener-ready', {
      isLive: stationData.isLive,
      track: stationData.currentTrack
    });

    if (stationData.broadcaster) {
      socket.to(stationData.broadcaster).emit('watcher', socket.id);
    }

    io.emit('listeners-update', stationData.listeners.size);
    console.log(`[${new Date().toISOString()}] Слушатель подключен: ${socket.id} (Всего: ${stationData.listeners.size})`);
  });

  // WebRTC сигналы
  socket.on('offer', (id, message) => {
    socket.to(id).emit('offer', socket.id, message);
  });

  socket.on('answer', (id, message) => {
    socket.to(id).emit('answer', socket.id, message);
  });

  socket.on('candidate', (id, message) => {
    socket.to(id).emit('candidate', socket.id, message);
  });

  // Обновление трека
  socket.on('track-update', (track) => {
    if (socket.id === stationData.broadcaster) {
      stationData.currentTrack = track;
      socket.broadcast.emit('track-update', track);
      console.log(`[${new Date().toISOString()}] Трек обновлен: ${track.artist} - ${track.title}`);
    }
  });

  // Получение статуса
  socket.on('get-status', () => {
    socket.emit('status', {
      isLive: stationData.isLive,
      track: stationData.currentTrack,
      listeners: stationData.listeners.size
    });
  });

  // Отключение
  socket.on('disconnect', () => {
    if (socket.id === stationData.broadcaster) {
      stationData.broadcaster = null;
      stationData.isLive = false;
      io.emit('broadcaster-disconnected');
      io.emit('status-update', { isLive: false });
      console.log(`[${new Date().toISOString()}] Диджей отключился: ${socket.id}`);
    } else if (stationData.listeners.has(socket.id)) {
      stationData.listeners.delete(socket.id);
      io.emit('listeners-update', stationData.listeners.size);
      console.log(`[${new Date().toISOString()}] Слушатель отключился: ${socket.id} (Осталось: ${stationData.listeners.size})`);
    }
  });

  // Принудительное отключение диджея
  socket.on('broadcaster-disconnect', () => {
    if (socket.id === stationData.broadcaster) {
      stationData.broadcaster = null;
      stationData.isLive = false;
      io.emit('broadcaster-disconnected');
      io.emit('status-update', { isLive: false });
    }
  });
});

// Обработка ошибок
process.on('uncaughtException', (err) => {
  console.error('Необработанное исключение:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Необработанное отклонение промиса:', reason);
});

// Порт для бесплатных хостингов (Render использует PORT из env, Railway тоже)
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`╔════════════════════════════════════════╗`);
  console.log(`║      🎵 LynchFM Radio Server 🎵      ║`);
  console.log(`╚════════════════════════════════════════╝`);
  console.log(`📻 Сервер запущен на ${HOST}:${PORT}`);
  console.log(`🌐 Откройте http://localhost:${PORT} в браузере`);
  console.log(`🚀 Готов к продакшену`);
  console.log(`══════════════════════════════════════════`);
});
