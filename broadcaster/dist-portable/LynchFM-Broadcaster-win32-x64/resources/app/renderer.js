const { ipcRenderer } = require('electron');
const io = require('socket.io-client');

let socket = null;
let localStream = null;
let audioContext = null;
let analyser = null;
let peerConnections = {};
let isConnected = false;

// DOM элементы
const elements = {
    serverUrl: document.getElementById('serverUrl'),
    audioSource: document.getElementById('audioSource'),
    connectBtn: document.getElementById('connectBtn'),
    disconnectBtn: document.getElementById('disconnectBtn'),
    connectionDot: document.getElementById('connectionDot'),
    connectionStatus: document.getElementById('connectionStatus'),
    trackTitle: document.getElementById('trackTitle'),
    trackArtist: document.getElementById('trackArtist'),
    updateTrackBtn: document.getElementById('updateTrackBtn'),
    visualizer: document.getElementById('visualizer'),
    volumeControl: document.getElementById('volumeControl'),
    volumeValue: document.getElementById('volumeValue'),
    listenersCount: document.getElementById('listenersCount'),
    broadcastStatus: document.getElementById('broadcastStatus')
};

// Инициализация визуализатора
function initVisualizer() {
    const canvas = elements.visualizer;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    function draw() {
        requestAnimationFrame(draw);

        if (!analyser) return;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            barHeight = (dataArray[i] / 255) * canvas.height;

            const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
            gradient.addColorStop(0, '#6366f1');
            gradient.addColorStop(1, '#8b5cf6');

            ctx.fillStyle = gradient;
            ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

            x += barWidth + 1;
        }
    }

    draw();
}

// Подключение к серверу
elements.connectBtn.addEventListener('click', async () => {
    const serverUrl = elements.serverUrl.value.trim();
    if (!serverUrl) {
        alert('Введите URL сервера');
        return;
    }

    try {
        await connectToServer(serverUrl);
    } catch (error) {
        console.error('Ошибка подключения:', error);
        alert('Не удалось подключиться к серверу');
    }
});

// Отключение
elements.disconnectBtn.addEventListener('click', () => {
    disconnect();
});

// Обновление информации о треке
elements.updateTrackBtn.addEventListener('click', () => {
    if (!socket || !isConnected) {
        alert('Сначала подключитесь к серверу');
        return;
    }

    const track = {
        title: elements.trackTitle.value || 'LynchFM',
        artist: elements.trackArtist.value || '88.8 FM'
    };

    socket.emit('track-update', track);
});

// Громкость
elements.volumeControl.addEventListener('input', (e) => {
    const volume = e.target.value / 100;
    if (localStream) {
        localStream.getAudioTracks().forEach(track => {
            if (track.getSettings().volume !== undefined) {
                track.applyConstraints({ volume: volume });
            }
        });
    }
    elements.volumeValue.textContent = e.target.value + '%';
});

// Подключение к серверу
async function connectToServer(serverUrl) {
    // Подключаем Socket.io
    socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
    });

    socket.on('connect', async () => {
        console.log('Подключено к серверу');
        isConnected = true;
        updateConnectionStatus(true);

        // Получаем аудио поток
        try {
            await startBroadcasting();
        } catch (error) {
            console.error('Ошибка начала вещания:', error);
            alert('Не удалось начать вещание: ' + error.message);
        }
    });

    socket.on('disconnect', () => {
        console.log('Отключено от сервера');
        isConnected = false;
        updateConnectionStatus(false);
    });

    socket.on('error', (error) => {
        console.error('Ошибка сервера:', error);
        alert('Ошибка сервера: ' + error);
    });

    socket.on('listeners-update', (count) => {
        elements.listenersCount.textContent = count;
    });

    socket.on('watcher', (id) => {
        createPeerConnection(id, false);
        peerConnections[id].createOffer()
            .then(offer => peerConnections[id].setLocalDescription(offer))
            .then(() => socket.emit('offer', id, peerConnections[id].localDescription));
    });

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
}

// Начало вещания
async function startBroadcasting() {
    const source = elements.audioSource.value;
    let constraints = {};

    if (source === 'microphone') {
        constraints = {
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        };
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
    } else if (source === 'virtual') {
        // Виртуальный канал
        const deviceId = document.getElementById('virtualDevice').value;
        if (!deviceId) {
            alert('Выберите виртуальное устройство!');
            return;
        }
        constraints = {
            audio: {
                deviceId: { exact: deviceId },
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                sampleRate: 44100
            }
        };
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
    } else {
        // Системный звук (требует разрешения)
        try {
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: false,
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: 44100
                }
            });

            const audioTracks = displayStream.getAudioTracks();
            if (audioTracks.length > 0) {
                localStream = new MediaStream(audioTracks);
            } else {
                throw new Error('Не удалось захватить системный звук');
            }
        } catch (error) {
            console.error('Ошибка захвата системного звука:', error);
            alert('Не удалось захватить системный звук. Выберите вкладку/окно с музыкой при запросе доступа.');
            return;
        }
    }

    if (!localStream) {
        alert('Не удалось получить доступ к аудио!');
        return;
    }

    // Создаем аудио контекст для визуализации
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(localStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    // Подключаемся как диджей
    socket.emit('broadcaster-connect', {
        track: {
            title: elements.trackTitle.value || 'LynchFM',
            artist: elements.trackArtist.value || '88.8 FM'
        }
    });

    elements.broadcastStatus.textContent = 'В эфире';
    elements.broadcastStatus.style.color = '#10b981';
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

    if (isBroadcaster && localStream) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
    }

    peerConnection.onicecandidate = (event) => {
        if (event.candidate && socket) {
            socket.emit('candidate', id, event.candidate);
        }
    };

    peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === 'failed' || 
            peerConnection.connectionState === 'closed') {
            delete peerConnections[id];
        }
    };
}

// Отключение
function disconnect() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }

    Object.values(peerConnections).forEach(pc => pc.close());
    peerConnections = {};

    if (socket) {
        socket.emit('broadcaster-disconnect');
        socket.disconnect();
        socket = null;
    }

    isConnected = false;
    updateConnectionStatus(false);
    elements.broadcastStatus.textContent = 'Оффлайн';
    elements.broadcastStatus.style.color = '#ef4444';
}

// Обновление статуса подключения
function updateConnectionStatus(connected) {
    if (connected) {
        elements.connectionDot.classList.add('connected');
        elements.connectionStatus.textContent = 'Подключено';
        elements.connectBtn.style.display = 'none';
        elements.disconnectBtn.style.display = 'inline-block';
    } else {
        elements.connectionDot.classList.remove('connected');
        elements.connectionStatus.textContent = 'Отключено';
        elements.connectBtn.style.display = 'inline-block';
        elements.disconnectBtn.style.display = 'none';
    }
}

// Обработчик изменения источника звука
elements.audioSource.addEventListener('change', (e) => {
    const source = e.target.value;
    const virtualGroup = document.getElementById('virtualDeviceGroup');
    if (source === 'virtual') {
        virtualGroup.style.display = 'block';
        loadAudioDevices();
    } else {
        virtualGroup.style.display = 'none';
    }
});

// Обновление списка устройств
const refreshDevicesBtn = document.getElementById('refreshDevicesBtn');
if (refreshDevicesBtn) {
    refreshDevicesBtn.addEventListener('click', () => {
        loadAudioDevices();
    });
}

// Инициализация
initVisualizer();
loadAudioDevices();

