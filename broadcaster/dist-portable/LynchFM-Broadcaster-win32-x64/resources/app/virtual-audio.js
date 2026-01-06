// Виртуальный аудио канал для захвата звука без локального воспроизведения
// Для Windows использует VB-Audio Virtual Cable
// Для других систем использует альтернативные методы

const { app, ipcMain } = require('electron');

class VirtualAudioCapture {
    constructor() {
        this.audioDevices = [];
        this.selectedDevice = null;
        this.stream = null;
    }

    // Получение списка аудио устройств
    async getAudioDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices
                .filter(device => device.kind === 'audioinput')
                .map(device => ({
                    id: device.deviceId,
                    label: device.label || `Микрофон ${device.deviceId.substring(0, 8)}`,
                    kind: device.kind
                }));
        } catch (error) {
            console.error('Ошибка получения устройств:', error);
            return [];
        }
    }

    // Захват звука с виртуального устройства
    async captureFromVirtualDevice(deviceId) {
        try {
            const constraints = {
                audio: {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: 44100,
                    channelCount: 2
                }
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Важно: не воспроизводим локально
            // Отключаем автоматическое воспроизведение
            const audioTracks = this.stream.getAudioTracks();
            audioTracks.forEach(track => {
                // Track settings не поддерживают отключение локального воспроизведения
                // Но мы можем настроить так, чтобы звук не проигрывался
            });

            return this.stream;
        } catch (error) {
            console.error('Ошибка захвата:', error);
            throw error;
        }
    }

    // Захват системного звука (Screen Capture API)
    async captureSystemAudio() {
        try {
            // Используем Screen Capture API для захвата системного звука
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
                this.stream = new MediaStream(audioTracks);
                return this.stream;
            } else {
                throw new Error('Не удалось захватить аудио трек');
            }
        } catch (error) {
            console.error('Ошибка захвата системного звука:', error);
            throw error;
        }
    }

    // Остановка захвата
    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }
}

// Инструкции по настройке виртуального аудио кабеля

const setupInstructions = {
    windows: {
        title: 'Настройка VB-Audio Virtual Cable для Windows',
        steps: [
            '1. Скачайте и установите VB-Audio Virtual Cable с официального сайта',
            '2. После установки в настройках звука Windows появится устройство "CABLE Input"',
            '3. В приложении для воспроизведения музыки (Яндекс.Музыка, Spotify и т.д.) выберите "CABLE Input" как устройство вывода',
            '4. В настройках LynchFM Broadcaster выберите "CABLE Output" как источник звука',
            '5. Теперь звук будет передаваться на радио без локального воспроизведения'
        ]
    },
    mac: {
        title: 'Настройка виртуального аудио для macOS',
        steps: [
            '1. Используйте встроенный Multi-Output Device или установите Soundflower/BlackHole',
            '2. В настройках звука macOS создайте Multi-Output Device',
            '3. Добавьте в него BlackHole или Soundflower',
            '4. В приложении для музыки выберите Multi-Output Device',
            '5. В Broadcaster выберите BlackHole/Soundflower как источник'
        ]
    },
    linux: {
        title: 'Настройка JACK для Linux',
        steps: [
            '1. Установите JACK Audio Connection Kit',
            '2. Настройте JACK сервер',
            '3. Используйте QjackCtl для управления соединениями',
            '4. Подключите приложение музыки к виртуальному выходу JACK',
            '5. В Broadcaster выберите виртуальный вход JACK'
        ]
    }
};

module.exports = { VirtualAudioCapture, setupInstructions };

