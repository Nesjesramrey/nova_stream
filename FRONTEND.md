# Documentación del Frontend - Amazon Nova Sonic Web Client

## Tabla de Contenidos
- [Arquitectura General](#arquitectura-general)
- [Componentes Principales](#componentes-principales)
- [Interfaz de Usuario](#interfaz-de-usuario)
- [Gestión de Audio](#gestión-de-audio)
- [Comunicación WebSocket](#comunicación-websocket)
- [Gestión de Chat](#gestión-de-chat)
- [Subida de PDFs](#subida-de-pdfs)
- [Flujo de Usuario](#flujo-de-usuario)
- [Estados de la Aplicación](#estados-de-la-aplicación)
- [Compatibilidad de Navegadores](#compatibilidad-de-navegadores)

## Arquitectura General

El frontend es una aplicación web moderna construida con JavaScript vanilla (ES6+), HTML5 y CSS3. Utiliza APIs nativas del navegador para el manejo de audio y comunicación en tiempo real mediante Socket.IO.

### Stack Tecnológico
- **Lenguaje**: JavaScript ES6+ (Modules)
- **WebSockets**: Socket.IO Client
- **Audio**: Web Audio API, AudioWorklet
- **UI**: HTML5 + CSS3 (sin frameworks)
- **Módulos**: ES6 Modules nativos
- **Compatibilidad**: Navegadores modernos con Web Audio API

### Arquitectura de Componentes
```
Frontend Application
├── Main Controller (main.js)
├── Audio System
│   ├── AudioPlayer (Reproducción)
│   └── AudioProcessor (Captura y procesamiento)
├── Chat Management
│   └── ChatHistoryManager (Gestión de conversación)
├── PDF Upload (pdf-upload.js)
└── UI Components (Estáticos en HTML/CSS)
```

## Componentes Principales

### 1. Controlador Principal (`public/src/main.js`)
Es el núcleo de la aplicación que coordina todas las funcionalidades.

**Responsabilidades:**
- Inicialización de WebSocket y Audio Context
- Gestión del ciclo de vida de streaming
- Coordinación entre componentes
- Manejo de eventos de usuario
- Control del estado de la aplicación

**Variables Globales Clave:**
```javascript
// Contexto de audio y streaming
let audioContext;
let audioStream;
let isStreaming = false;
let processor;
let sourceNode;

// Estados de la conversación
let waitingForAssistantResponse = false;
let waitingForUserTranscription = false;
let sessionInitialized = false;

// Gestión de UI
let userThinkingIndicator = null;
let assistantThinkingIndicator = null;
```

### 2. Sistema de Audio (`public/src/lib/play/AudioPlayer.js`)
Maneja la reproducción y procesamiento de audio en tiempo real.

**Características:**
- Sample rate de 24kHz para reproducción
- Análisis de audio en tiempo real con AnalyserNode
- Soporte para AudioWorklet para procesamiento de alta calidad
- Gestión de volumen y visualización de ondas

**Funcionalidades Principales:**
```javascript
// Inicialización del sistema de audio
async start() {
    this.audioContext = new AudioContext({ "sampleRate": 24000 });
    this.analyser = this.audioContext.createAnalyser();
    await this.audioContext.audioWorklet.addModule(AudioPlayerWorkletUrl);
}

// Reproducción de audio
playAudio(samples) {
    this.workletNode.port.postMessage({
        type: "audio",
        audioData: samples,
    });
}
```

### 3. Gestor de Historial de Chat (`public/src/lib/util/ChatHistoryManager.js`)
Maneja el estado y la visualización del historial de conversación.

**Patrón Singleton:**
```javascript
static getInstance(chatRef, setChat) {
    if (!ChatHistoryManager.instance) {
        ChatHistoryManager.instance = new ChatHistoryManager(chatRef, setChat);
    }
    return ChatHistoryManager.instance;
}
```

**Funcionalidades:**
- Agregación de mensajes por rol (usuario/asistente)
- Concatenación inteligente de mensajes del mismo rol
- Finalización de turnos y conversaciones
- Actualización reactiva de la UI

### 4. Subida de PDFs (`public/src/pdf-upload.js`)
Funcionalidad independiente para cargar documentos al Knowledge Base.

**Características:**
- Validación de tipo de archivo (solo PDFs)
- Upload asíncrono con feedback visual
- Seguimiento del estado de sincronización
- Polling del estado del job de ingestión

## Interfaz de Usuario

### Estructura HTML (`public/index.html`)
La interfaz está organizada en secciones modulares:

#### 1. Header Section
```html
<div class="header">
    <div class="header-content">
        <i class="fas fa-microphone-alt header-icon"></i>
        <h1>Speak English with Sonic</h1>
        <p>Powered by Amazon Bedrock & Amazon Nova Sonic</p>
    </div>
</div>
```

#### 2. Status Section
**Propósito**: Mostrar el estado actual de la conexión y sistema
**Estados**: `disconnected`, `connecting`, `ready`, `recording`, `error`

#### 3. Chat Section
**Propósito**: Visualización del historial de conversación
**Características**:
- Scroll automático
- Indicadores de "pensando"
- Diferenciación visual por roles

#### 4. Controls Section
**Componentes**:
- Botón Start Streaming
- Botón Stop Streaming
- Estados habilitado/deshabilitado dinámicos

#### 5. PDF Upload Section
**Funcionalidad**:
- Selector de archivos con drag & drop visual
- Indicador de progreso
- Feedback de estado de sincronización

### Estilos CSS (`public/src/style.css`)
**Características del diseño:**
- Diseño responsive y moderno
- Tema oscuro con acentos de color
- Animaciones y transiciones suaves
- Iconografía con Font Awesome
- Estados visuales claros

## Gestión de Audio

### Captura de Audio
El sistema captura audio del micrófono con configuraciones optimizadas:

```javascript
audioStream = await navigator.mediaDevices.getUserMedia({
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
    }
});
```

### Procesamiento de Audio
**Compatibilidad Multi-navegador:**
- **Chrome/Edge**: AudioContext a 16kHz directo
- **Firefox**: Downsampling desde sample rate nativo

**Proceso de Captura:**
1. MediaStreamSource captura del micrófono
2. ScriptProcessorNode procesa chunks de 512 samples
3. Conversión a PCM 16-bit
4. Encoding a Base64 para transmisión
5. Envío via WebSocket al servidor

```javascript
processor.onaudioprocess = (e) => {
    const inputData = e.inputBuffer.getChannelData(0);
    const pcmData = new Int16Array(inputData.length);
    
    // Conversión a PCM 16-bit
    for (let i = 0; i < inputData.length; i++) {
        pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
    }
    
    // Envío al servidor
    const base64Data = arrayBufferToBase64(pcmData.buffer);
    socket.emit('audioInput', base64Data);
};
```

### Reproducción de Audio
**AudioPlayer con WorkletProcessor:**
- Buffer de audio inteligente
- Análisis de volumen en tiempo real
- Capacidad de interrupción (barge-in)

## Comunicación WebSocket

### Eventos Emitidos al Servidor

#### 1. `promptStart`
**Timing**: Al inicializar sesión
**Propósito**: Señalar inicio de nueva conversación

#### 2. `systemPrompt`
**Timing**: Después de `promptStart`
**Propósito**: Enviar prompt del sistema personalizable
**Datos**: String con instrucciones del sistema

#### 3. `audioStart`
**Timing**: Después de `systemPrompt`
**Propósito**: Preparar servidor para streaming de audio

#### 4. `audioInput`
**Timing**: Durante streaming activo
**Propósito**: Transmisión continua de datos de audio
**Formato**: Base64 encoded PCM data

#### 5. `stopAudio`
**Timing**: Al parar streaming
**Propósito**: Señalar fin de entrada de audio y ejecutar cierre

### Eventos Recibidos del Servidor

#### 1. `textOutput`
**Respuesta**: Actualización de transcripción de texto
**Handler**: 
```javascript
socket.on('textOutput', (data) => {
    handleTextOutput(data);
    if (data.role === 'user') {
        transcriptionReceived = true;
        hideUserThinkingIndicator();
    }
});
```

#### 2. `audioOutput`
**Respuesta**: Audio sintetizado del asistente
**Procesamiento**: Conversión de base64 a Float32Array y reproducción

#### 3. `contentStart`
**Respuesta**: Inicio de respuesta del asistente
**Acción**: Mostrar indicador de "pensando" del asistente

#### 4. `contentEnd`
**Respuesta**: Fin de respuesta del asistente
**Acción**: Ocultar indicadores y finalizar turno

#### 5. `error`
**Respuesta**: Errores del servidor
**Acción**: Mostrar mensaje de error y restablecer estado

## Gestión de Chat

### Estructura de Mensajes
```javascript
const message = {
    role: 'user' | 'assistant',
    message: 'Contenido del texto',
    endOfResponse: boolean
};
```

### Funciones de Chat

#### Actualización de UI
```javascript
function updateChatUI() {
    const container = document.getElementById('chat-container');
    container.innerHTML = '';
    
    chat.history.forEach(turn => {
        if (turn.endOfConversation) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${turn.role}`;
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-text">${turn.message}</div>
            </div>
        `;
        container.appendChild(messageDiv);
    });
    
    container.scrollTop = container.scrollHeight;
}
```

#### Indicadores de Estado
- **Usuario pensando**: Durante captura de audio antes de transcripción
- **Asistente pensando**: Desde `contentStart` hasta `contentEnd`
- **Animaciones**: Puntos animados con CSS

## Subida de PDFs

### Flujo de Subida
1. **Validación**: Verificar tipo de archivo (PDF únicamente)
2. **Preparación**: Crear FormData con el archivo
3. **Upload**: POST request a `/api/pdf`
4. **Seguimiento**: Polling del estado del job de sincronización
5. **Feedback**: Actualización visual del progreso

### Manejo de Estados
```javascript
async function pollJobStatus(jobId) {
    let attempts = 0;
    const maxAttempts = 10;
    const pollInterval = 10000; // 10 segundos
    
    const checkStatus = async () => {
        const response = await fetch(`/api/sync-status/${jobId}`);
        const result = await response.json();
        
        if (result.data.status === 'COMPLETE') {
            updateStatus('Knowledge Base sync completed!', 'success');
            return;
        }
        
        if (attempts < maxAttempts) {
            setTimeout(checkStatus, pollInterval);
        }
    };
}
```

## Flujo de Usuario

### 1. Inicialización
```
Carga de página → Solicitar micrófono → Inicializar Audio Context → Estado "Ready"
```

### 2. Conversación
```
Click Start → Inicializar sesión → Comenzar streaming → Capturar audio → 
Recibir transcripción → Mostrar respuesta → Audio del asistente → Finalizar turno
```

### 3. Subida de PDF
```
Seleccionar archivo → Validar → Upload → Polling estado → Confirmación
```

## Estados de la Aplicación

### Estados del Sistema
1. **`disconnected`**: Estado inicial, sin conexión
2. **`connecting`**: Solicitando permisos de micrófono
3. **`ready`**: Listo para iniciar streaming
4. **`recording`**: Streaming activo de audio
5. **`error`**: Error en el sistema

### Estados de la Conversación
- **`waitingForAssistantResponse`**: Esperando respuesta del modelo
- **`waitingForUserTranscription`**: Esperando transcripción del usuario
- **`transcriptionReceived`**: Transcripción completada
- **`sessionInitialized`**: Sesión configurada con Bedrock

### Indicadores Visuales
```javascript
// Indicador de usuario pensando
function showUserThinkingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'message user thinking';
    indicator.innerHTML = `
        <div class="message-content">
            <div class="typing-indicator">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
}
```

## Compatibilidad de Navegadores

### Navegadores Soportados
- **Chrome/Chromium 66+**: Soporte completo
- **Firefox 76+**: Con ajustes de sample rate
- **Safari 14.1+**: Soporte básico
- **Edge 79+**: Soporte completo

### Características Específicas por Navegador

#### Chrome/Edge
- AudioContext con sample rate personalizado (16kHz)
- Sampling ratio 1:1
- AudioWorklet completo

#### Firefox
- Sample rate nativo del dispositivo
- Downsampling manual requerido
- Sampling ratio variable

```javascript
const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');

if (isFirefox) {
    audioContext = new AudioContext(); // Sample rate nativo
    samplingRatio = audioContext.sampleRate / TARGET_SAMPLE_RATE;
} else {
    audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
}
```

### APIs Requeridas
- **Web Audio API**: Para procesamiento de audio
- **MediaDevices API**: Para acceso al micrófono
- **AudioWorklet**: Para procesamiento avanzado
- **WebSocket/Socket.IO**: Para comunicación en tiempo real
- **Fetch API**: Para subida de archivos

### Consideraciones de Rendimiento
- **Chunks de audio**: 512 samples para latencia baja
- **Buffer management**: Limpieza automática de recursos
- **Memory usage**: Gestión cuidadosa de AudioBuffers
- **Real-time processing**: Optimizado para streaming continuo 