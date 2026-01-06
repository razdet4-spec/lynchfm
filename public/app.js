// Инициализация Socket.io
// Используем текущий домен - все работает на одном сервере (Render)
const socket = io();
let audioContext = null;
let analyser = null;
let peerConnections = {};
let isListening = false;
let isPlaying = false;
let currentStream = null;

// DOM элементы
const elements = {
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText'),
    vinyl: document.getElementById('vinyl'),
    needle: document.getElementById('needle'),
    trackTitle: document.getElementById('trackTitle'),
    trackArtist: document.getElementById('trackArtist'),
    trackCover: document.getElementById('trackCover'),
    currentTime: document.getElementById('currentTime'),
    totalTime: document.getElementById('totalTime'),
    playBtn: document.getElementById('playBtn'),
    volumeSlider: document.getElementById('volumeSlider'),
    volumeValue: document.getElementById('volumeValue'),
    audioPlayer: document.getElementById('audioPlayer'),
    listenersCount: document.getElementById('listenersCount'),
    peakListeners: document.getElementById('peakListeners'),
    uptime: document.getElementById('uptime'),
    webPlayerBtn: document.getElementById('webPlayerBtn')
};

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    initSocketListeners();
    loadStationStatus();
    updateUptime();
    setInterval(updateUptime, 1000);
});

// Обработчики событий
function initEventListeners() {
    // Кнопка воспроизведения
    elements.playBtn.addEventListener('click', togglePlayback);
    
    // Громкость
    elements.volumeSlider.addEventListener('input', (e) => {
        const volume = e.target.value / 100;
        elements.audioPlayer.volume = volume;
        elements.volumeValue.textContent = e.target.value + '%';
    });
    
    // Навигация
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.scrollIntoView({ behavior: 'smooth' });
                updateActiveNav(link);
            }
        });
    });
    
    // Кнопка веб-плеера
    if (elements.webPlayerBtn) {
        elements.webPlayerBtn.addEventListener('click', () => {
            togglePlayback();
            document.getElementById('home').scrollIntoView({ behavior: 'smooth' });
        });
    }
    
    // Обновление времени трека
    elements.audioPlayer.addEventListener('timeupdate', () => {
        updateTimeDisplay();
    });
    
    elements.audioPlayer.addEventListener('loadedmetadata', () => {
        updateTimeDisplay();
    });
}

// Socket.io обработчики
function initSocketListeners() {
    // Статус станции
    socket.on('status', (data) => {
        updateStationStatus(data);
    });
    
    socket.on('status-update', (data) => {
        updateStationStatus(data);
    });
    
    // Подключение диджея
    socket.on('broadcaster-connected', (data) => {
        if (data.track) {
            updateTrackInfo(data.track);
        }
        updateStationStatus({ isLive: true });
    });
    
    // Отключение диджея
    socket.on('broadcaster-disconnected', () => {
        updateStationStatus({ isLive: false });
        stopPlayback();
    });
    
    // Обновление трека
    socket.on('track-update', (track) => {
        updateTrackInfo(track);
    });
    
    // Обновление количества слушателей
    socket.on('listeners-update', (count) => {
        elements.listenersCount.textContent = count;
    });
    
    // Готовность слушателя
    socket.on('listener-ready', (data) => {
        if (data.isLive) {
            updateStationStatus(data);
            // Если есть трансляция, пытаемся подключиться
            if (!isPlaying && data.isLive) {
                startPlayback();
            }
        }
    });
    
    // Получение сигнала о наличии диджея
    socket.on('broadcaster', () => {
        // Диджей подключился, обновляем статус
        socket.emit('get-status');
    });
    
    // WebRTC сигналы
    socket.on('offer', (id, message) => {
        createPeerConnection(id, true);
        peerConnections[id].setRemoteDescription(new RTCSessionDescription(message))
            .then(() => peerConnections[id].createAnswer())
            .then(answer => peerConnections[id].setLocalDescription(answer))
            .then(() => socket.emit('answer', id, peerConnections[id].localDescription));
    });
    
    socket.on('answer', (id, message) => {
        if (peerConnections[id]) {
            peerConnections[id].setRemoteDescription(new RTCSessionDescription(message));
        }
    });
    
    socket.on('candidate', (id, message) => {
        if (peerConnections[id]) {
            peerConnections[id].addIceCandidate(new RTCIceCandidate(message));
        }
    });
    
    socket.on('watcher', (id) => {
        createPeerConnection(id, false);
        peerConnections[id].createOffer()
            .then(offer => peerConnections[id].setLocalDescription(offer))
            .then(() => socket.emit('offer', id, peerConnections[id].localDescription));
    });
}

// Создание WebRTC соединения
function createPeerConnection(id, isBroadcaster) {
    const peerConnection = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    });
    
    peerConnections[id] = peerConnection;
    
    if (isBroadcaster && currentStream) {
        currentStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, currentStream);
        });
    }
    
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('candidate', id, event.candidate);
        }
    };
    
    if (!isBroadcaster) {
        peerConnection.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
                currentStream = event.streams[0];
                elements.audioPlayer.srcObject = currentStream;
                startPlayback();
            }
        };
    }
    
    peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === 'failed' || 
            peerConnection.connectionState === 'closed') {
            delete peerConnections[id];
        }
    };
}

// Обновление статуса станции
function updateStationStatus(data) {
    const isLive = data.isLive || false;
    
    if (isLive) {
        elements.statusDot.classList.add('live');
        elements.statusText.textContent = 'В ЭФИРЕ';
        elements.vinyl.classList.add('playing');
        elements.needle.classList.add('playing');
    } else {
        elements.statusDot.classList.remove('live');
        elements.statusText.textContent = 'ОФФЛАЙН';
        elements.vinyl.classList.remove('playing');
        elements.needle.classList.remove('playing');
    }
    
    if (data.track) {
        updateTrackInfo(data.track);
    }
}

// Обновление информации о треке
function updateTrackInfo(track) {
    if (track.title) {
        elements.trackTitle.textContent = track.title;
    }
    if (track.artist) {
        elements.trackArtist.textContent = track.artist;
    }
    if (track.cover) {
        elements.trackCover.innerHTML = `<img src="${track.cover}" alt="${track.title}">`;
    }
}

// Воспроизведение/пауза
function togglePlayback() {
    if (!isListening) {
        // Подключаемся как слушатель
        socket.emit('listener-connect');
        isListening = true;
        // Проверяем статус после подключения
        setTimeout(() => {
            socket.emit('get-status');
        }, 500);
    }
    
    if (isPlaying) {
        stopPlayback();
    } else {
        // Проверяем статус перед воспроизведением
        socket.emit('get-status');
        startPlayback();
    }
}

function startPlayback() {
    if (elements.audioPlayer.srcObject || elements.audioPlayer.src) {
        elements.audioPlayer.play().catch(err => {
            console.error('Ошибка воспроизведения:', err);
        });
        isPlaying = true;
        updatePlayButton(true);
    }
}

function stopPlayback() {
    elements.audioPlayer.pause();
    isPlaying = false;
    updatePlayButton(false);
}

function updatePlayButton(playing) {
    if (playing) {
        elements.playBtn.innerHTML = `
            <svg class="play-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            </svg>
        `;
    } else {
        elements.playBtn.innerHTML = `
            <svg class="play-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
            </svg>
        `;
    }
}

// Обновление времени
function updateTimeDisplay() {
    const current = formatTime(elements.audioPlayer.currentTime);
    const total = formatTime(elements.audioPlayer.duration || 0);
    elements.currentTime.textContent = current;
    elements.totalTime.textContent = total;
}

function formatTime(seconds) {
    if (!isFinite(seconds)) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Загрузка статуса станции
function loadStationStatus() {
    fetch('/api/status')
        .then(res => res.json())
        .then(data => {
            updateStationStatus(data);
            elements.listenersCount.textContent = data.listeners || 0;
            if (data.stats) {
                elements.peakListeners.textContent = data.stats.peakListeners || 0;
            }
            // Если есть трансляция, подключаемся
            if (data.isLive && !isListening) {
                socket.emit('listener-connect');
            }
        })
        .catch(err => console.error('Ошибка загрузки статуса:', err));
    
    socket.emit('get-status');
    
    // Периодическое обновление статуса
    setInterval(() => {
        fetch('/api/status')
            .then(res => res.json())
            .then(data => {
                updateStationStatus(data);
                elements.listenersCount.textContent = data.listeners || 0;
            })
            .catch(() => {});
        socket.emit('get-status');
    }, 5000);
}

// Обновление времени работы станции
function updateUptime() {
    fetch('/api/stats')
        .then(res => res.json())
        .then(data => {
            if (data.uptime) {
                const seconds = Math.floor(data.uptime / 1000);
                const hours = Math.floor(seconds / 3600);
                const minutes = Math.floor((seconds % 3600) / 60);
                elements.uptime.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            }
        })
        .catch(() => {});
}

// Обновление активной навигации
function updateActiveNav(activeLink) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    activeLink.classList.add('active');
}

// Плавная прокрутка при загрузке
window.addEventListener('load', () => {
    if (window.location.hash) {
        const target = document.querySelector(window.location.hash);
        if (target) {
            setTimeout(() => {
                target.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
    }
});
