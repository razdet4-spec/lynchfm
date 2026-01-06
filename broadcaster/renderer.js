const { ipcRenderer } = require('electron');
const io = require('socket.io-client');

let socket = null;
let localStream = null;
let audioContext = null;
let analyser = null;
let peerConnections = {};
let isConnected = false;
let isBroadcasting = false;

// DOM элементы
const elements = {
    serverUrl: document.getElementById('serverUrl'),
    audioSource: document.getElementById('audioSource'),
    connectBtn: document.getElementById('connectBtn'),
    disconnectBtn: document.getElementById('disconnectBtn'),
    startBroadcastBtn: document.getElementById('startBroadcastBtn'),
    stopBroadcastBtn: document.getElementById('stopBroadcastBtn'),
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
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    function draw() {
        requestAnimationFrame(draw);

        if (!analyser) {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            return;
        }

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

// Проверка доступа к медиа устройствам
async function checkMediaPermissions() {
    try {
        // Проверяем доступ к микрофону
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStream.getTracks().forEach(track => track.stop());
        console.log('✅ Доступ к микрофону разрешен');
        return true;
    } catch (error) {
        console.error('❌ Нет доступа к микрофону:', error);
        const result = confirm('Программе нужен доступ к микрофону и звуку!\n\nНажмите OK чтобы разрешить доступ.\n\nВ появившемся окне нажмите "Разрешить"');
        if (result) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(track => track.stop());
                return true;
            } catch (e) {
                alert('Доступ запрещен! Разрешите доступ к микрофону в настройках Windows.');
                return false;
            }
        }
        return false;
    }
}

// Подключение к серверу
elements.connectBtn.addEventListener('click', async () => {
    const serverUrl = elements.serverUrl.value.trim();
    if (!serverUrl) {
        alert('Введите URL сервера!');
        return;
    }

    elements.connectBtn.disabled = true;
    elements.connectBtn.textContent = 'Подключение...';

    try {
        await connectToServer(serverUrl);
    } catch (error) {
        console.error('Ошибка подключения:', error);
        alert('Не удалось подключиться к серверу:\n' + error.message);
        elements.connectBtn.disabled = false;
        elements.connectBtn.textContent = 'Подключиться к серверу';
    }
});

// Отключение
elements.disconnectBtn.addEventListener('click', () => {
    disconnect();
});

// Начало трансляции
elements.startBroadcastBtn.addEventListener('click', async () => {
    if (!socket || !socket.connected) {
        alert('Сначала подключитесь к серверу!');
        return;
    }
    
    if (isBroadcasting) {
        alert('Трансляция уже идет!');
        return;
    }
    
    elements.startBroadcastBtn.disabled = true;
    elements.startBroadcastBtn.textContent = 'Подготовка...';
    
    try {
        await startBroadcasting();
    } catch (error) {
        console.error('Ошибка начала вещания:', error);
        alert('Не удалось начать вещание:\n' + error.message);
        elements.startBroadcastBtn.disabled = false;
        elements.startBroadcastBtn.textContent = 'Начать трансляцию';
    }
});

// Остановка трансляции
elements.stopBroadcastBtn.addEventListener('click', () => {
    stopBroadcasting();
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
    alert('Информация о треке обновлена!');
});

// Громкость
elements.volumeControl.addEventListener('input', (e) => {
    elements.volumeValue.textContent = e.target.value + '%';
});

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

// Загрузка аудио устройств
async function loadAudioDevices() {
    try {
        // Сначала запрашиваем доступ
        await navigator.mediaDevices.getUserMedia({ audio: true });
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        
        const virtualDeviceSelect = document.getElementById('virtualDevice');
        virtualDeviceSelect.innerHTML = '<option value="">Выберите устройство...</option>';
        
        audioInputs.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Устройство ${device.deviceId.substring(0, 8)}`;
            virtualDeviceSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Ошибка загрузки устройств:', error);
        alert('Не удалось загрузить список устройств. Разрешите доступ к микрофону.');
    }
}

// Обновление списка устройств
const refreshDevicesBtn = document.getElementById('refreshDevicesBtn');
if (refreshDevicesBtn) {
    refreshDevicesBtn.addEventListener('click', () => {
        loadAudioDevices();
    });
}

// Подключение к серверу
async function connectToServer(serverUrl) {
    // Нормализуем URL
    let normalizedUrl = serverUrl.trim();
    if (normalizedUrl.endsWith('/')) {
        normalizedUrl = normalizedUrl.slice(0, -1);
    }
    
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = 'https://' + normalizedUrl;
    }
    
    console.log('🔌 Подключение к серверу:', normalizedUrl);
    
    // Если уже подключен, отключаемся
    if (socket && socket.connected) {
        socket.disconnect();
        socket = null;
    }
    
    // Подключаем Socket.io
    socket = io(normalizedUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10,
        timeout: 20000,
        forceNew: true
    });

    socket.on('connect', () => {
        console.log('✅ Подключено к серверу:', normalizedUrl);
        isConnected = true;
        updateConnectionStatus(true);
        
        elements.startBroadcastBtn.style.display = 'inline-block';
        elements.startBroadcastBtn.disabled = false;
        elements.startBroadcastBtn.textContent = 'Начать трансляцию';
        elements.broadcastStatus.textContent = 'Подключено (готов к трансляции)';
        elements.broadcastStatus.style.color = '#10b981';
    });
    
    socket.on('connect_error', (error) => {
        console.error('❌ Ошибка подключения:', error);
        alert('Не удалось подключиться к серверу!\n\nПроверьте:\n- Правильность URL\n- Что сервер запущен\n- Интернет соединение');
        updateConnectionStatus(false);
        elements.connectBtn.disabled = false;
        elements.connectBtn.textContent = 'Подключиться к серверу';
    });

    socket.on('disconnect', (reason) => {
        console.log('Отключено от сервера:', reason);
        isConnected = false;
        isBroadcasting = false;
        updateConnectionStatus(false);
        elements.broadcastStatus.textContent = 'Отключено';
        elements.broadcastStatus.style.color = '#ef4444';
        elements.startBroadcastBtn.style.display = 'none';
        elements.stopBroadcastBtn.style.display = 'none';
    });

    socket.on('error', (error) => {
        console.error('Ошибка сервера:', error);
        alert('Ошибка сервера: ' + error);
    });

    socket.on('listeners-update', (count) => {
        elements.listenersCount.textContent = count;
    });
    
    socket.on('broadcaster-confirmed', (data) => {
        console.log('✅ Подтверждение статуса диджея:', data);
        isBroadcasting = true;
        elements.broadcastStatus.textContent = 'В ЭФИРЕ';
        elements.broadcastStatus.style.color = '#10b981';
        elements.startBroadcastBtn.style.display = 'none';
        elements.stopBroadcastBtn.style.display = 'inline-block';
    });
    
    socket.on('broadcaster-replaced', () => {
        alert('Вас заменил другой диджей. Трансляция остановлена.');
        stopBroadcasting();
    });

    socket.on('status-update', (data) => {
        console.log('Обновление статуса:', data);
        if (data.isLive && isBroadcasting) {
            elements.broadcastStatus.textContent = 'В ЭФИРЕ';
            elements.broadcastStatus.style.color = '#10b981';
        }
    });

    socket.on('watcher', (id) => {
        console.log('Новый слушатель:', id);
        if (localStream && isBroadcasting) {
            createPeerConnection(id, false);
            peerConnections[id].createOffer()
                .then(offer => peerConnections[id].setLocalDescription(offer))
                .then(() => socket.emit('offer', id, peerConnections[id].localDescription))
                .catch(err => console.error('Ошибка создания offer:', err));
        }
    });

    socket.on('offer', (id, message) => {
        if (localStream && isBroadcasting) {
            createPeerConnection(id, true);
            peerConnections[id].setRemoteDescription(new RTCSessionDescription(message))
                .then(() => peerConnections[id].createAnswer())
                .then(answer => peerConnections[id].setLocalDescription(answer))
                .then(() => socket.emit('answer', id, peerConnections[id].localDescription))
                .catch(err => console.error('Ошибка создания answer:', err));
        }
    });

    socket.on('answer', (id, message) => {
        if (peerConnections[id]) {
            peerConnections[id].setRemoteDescription(new RTCSessionDescription(message))
                .catch(err => console.error('Ошибка установки answer:', err));
        }
    });

    socket.on('candidate', (id, message) => {
        if (peerConnections[id]) {
            peerConnections[id].addIceCandidate(new RTCIceCandidate(message))
                .catch(err => console.error('Ошибка добавления candidate:', err));
        }
    });
}

// Начало вещания
async function startBroadcasting() {
    if (isBroadcasting) {
        throw new Error('Трансляция уже идет!');
    }
    
    if (!socket || !socket.connected) {
        throw new Error('Не подключено к серверу!');
    }
    
    // Проверяем доступ к медиа
    const hasAccess = await checkMediaPermissions();
    if (!hasAccess) {
        throw new Error('Нет доступа к микрофону/звуку');
    }
    
    const source = elements.audioSource.value;
    let constraints = {};

    console.log('🎙️ Начало вещания, источник:', source);

    if (source === 'microphone') {
        // Микрофон
        constraints = {
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 44100
            }
        };
        
        console.log('Запрос доступа к микрофону...');
        try {
            localStream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('✅ Доступ к микрофону получен');
        } catch (error) {
            console.error('❌ Ошибка доступа к микрофону:', error);
            throw new Error('Не удалось получить доступ к микрофону. Разрешите доступ в настройках Windows.');
        }
        
    } else if (source === 'virtual') {
        // Виртуальный канал
        const deviceId = document.getElementById('virtualDevice').value;
        if (!deviceId) {
            throw new Error('Выберите виртуальное устройство!');
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
        
        console.log('Запрос доступа к виртуальному устройству...');
        try {
            localStream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('✅ Доступ к виртуальному устройству получен');
        } catch (error) {
            console.error('❌ Ошибка доступа к виртуальному устройству:', error);
            throw new Error('Не удалось получить доступ к виртуальному устройству. Проверьте что VB-Audio Virtual Cable установлен.');
        }
        
    } else {
        // Системный звук
        console.log('Запрос доступа к системному звуку...');
        
        // Показываем инструкцию
        const confirmed = confirm(
            'СЕЙЧАС ПОЯВИТСЯ ЗАПРОС НА ДОСТУП К ЭКРАНУ И ЗВУКУ!\n\n' +
            'ВАЖНО:\n' +
            '1. Выберите вкладку/окно где играет музыка\n' +
            '2. ОБЯЗАТЕЛЬНО разрешите доступ к ЗВУКУ (поставьте галочку)\n' +
            '3. Нажмите "Поделиться"\n\n' +
            'Нажмите OK чтобы продолжить'
        );
        
        if (!confirmed) {
            throw new Error('Отменено пользователем');
        }
        
        try {
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: false,
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: 44100,
                    channelCount: 2
                }
            });

            const audioTracks = displayStream.getAudioTracks();
            console.log('Получены аудио треки:', audioTracks.length);
            
            if (audioTracks.length === 0) {
                throw new Error('Не удалось захватить звук. Убедитесь что вы разрешили доступ к ЗВУКУ!');
            }
            
            localStream = new MediaStream(audioTracks);
            console.log('✅ Системный звук захвачен');
            
            // Предупреждаем если трек остановлен
            audioTracks[0].onended = () => {
                console.log('⚠️ Аудио трек остановлен пользователем');
                alert('Захват звука был остановлен. Трансляция остановлена.');
                stopBroadcasting();
            };
            
        } catch (error) {
            console.error('❌ Ошибка захвата системного звука:', error);
            
            if (error.name === 'NotAllowedError') {
                throw new Error('Доступ к системному звуку запрещен!\n\nРазрешите доступ к экрану и звуку в настройках.');
            } else if (error.name === 'NotFoundError') {
                throw new Error('Не найдено устройство для захвата звука.\n\nУбедитесь что звук воспроизводится на компьютере.');
            } else {
                throw new Error('Не удалось захватить системный звук!\n\nВАЖНО: При запросе обязательно разрешите доступ к ЗВУКУ (галочка должна быть)!');
            }
        }
    }

    if (!localStream) {
        throw new Error('Не удалось получить аудио поток!');
    }

    console.log('✅ Аудио поток получен');

    // Создаем аудио контекст для визуализации
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(localStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    // Подключаемся как диджей
    if (socket && socket.connected) {
        console.log('Отправка запроса на подключение как диджей...');
        socket.emit('broadcaster-connect', {
            track: {
                title: elements.trackTitle.value || 'LynchFM',
                artist: elements.trackArtist.value || '88.8 FM'
            }
        });
        
        // Ждем подтверждения
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Таймаут ожидания подтверждения от сервера'));
            }, 5000);
            
            socket.once('broadcaster-confirmed', () => {
                clearTimeout(timeout);
                resolve();
            });
            
            socket.once('error', (err) => {
                clearTimeout(timeout);
                reject(new Error(err));
            });
        });
        
        console.log('✅ Вещание начато, статус: В ЭФИРЕ');
    } else {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        throw new Error('Socket не подключен!');
    }
}

// Остановка вещания
function stopBroadcasting() {
    if (!isBroadcasting) return;
    
    console.log('⏹️ Остановка вещания');
    
    isBroadcasting = false;
    
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

    if (socket && socket.connected) {
        socket.emit('broadcaster-disconnect');
    }

    elements.broadcastStatus.textContent = 'Трансляция остановлена';
    elements.broadcastStatus.style.color = '#ef4444';
    elements.startBroadcastBtn.style.display = 'inline-block';
    elements.startBroadcastBtn.disabled = false;
    elements.startBroadcastBtn.textContent = 'Начать трансляцию';
    elements.stopBroadcastBtn.style.display = 'none';
    analyser = null;
}

// Создание WebRTC соединения
function createPeerConnection(id, isBroadcaster) {
    if (peerConnections[id]) {
        console.log('Соединение уже существует:', id);
        return;
    }
    
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
            console.log('Добавлен трек в соединение:', id, track.kind);
        });
    }

    peerConnection.onicecandidate = (event) => {
        if (event.candidate && socket) {
            socket.emit('candidate', id, event.candidate);
        }
    };

    peerConnection.onconnectionstatechange = () => {
        console.log('Состояние соединения:', id, peerConnection.connectionState);
        if (peerConnection.connectionState === 'failed' || 
            peerConnection.connectionState === 'closed') {
            delete peerConnections[id];
        }
    };
}

// Отключение
function disconnect() {
    stopBroadcasting();
    
    if (socket) {
        socket.emit('broadcaster-disconnect');
        socket.disconnect();
        socket = null;
    }

    isConnected = false;
    updateConnectionStatus(false);
    elements.broadcastStatus.textContent = 'Оффлайн';
    elements.broadcastStatus.style.color = '#ef4444';
    elements.startBroadcastBtn.style.display = 'none';
    elements.stopBroadcastBtn.style.display = 'none';
    elements.connectBtn.disabled = false;
    elements.connectBtn.textContent = 'Подключиться к серверу';
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

// Инициализация
initVisualizer();
loadAudioDevices();

// Проверка доступа при загрузке
window.addEventListener('load', async () => {
    console.log('Проверка доступа к медиа устройствам...');
    await checkMediaPermissions();
});
