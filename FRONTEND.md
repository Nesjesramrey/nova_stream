# Documentación del Frontend - Amazon Nova Sonic Web Client

## Tabla de Contenidos
- [Arquitectura General](#arquitectura-general)
- [Componentes Principales](#componentes-principales)
- [Interfaz de Usuario](#interfaz-de-usuario)
- [Gestión de Audio](#gestión-de-audio)
- [Comunicación WebSocket](#comunicación-websocket)
- [Gestión de Chat](#gestión-de-chat)
- [Gestión de Fuentes de Conocimiento](#gestión-de-fuentes-de-conocimiento)
- [Subida de PDFs](#subida-de-pdfs)
- [Gestión de SharePoint](#gestión-de-sharepoint)
- [Flujo de Usuario](#flujo-de-usuario)
- [Estados de la Aplicación](#estados-de-la-aplicación)
- [Compatibilidad de Navegadores](#compatibilidad-de-navegadores)

## Arquitectura General

El frontend es una aplicación web moderna construida con JavaScript vanilla (ES6+), HTML5 y CSS3. Utiliza APIs nativas del navegador para el manejo de audio y comunicación en tiempo real mediante Socket.IO. **Ahora incluye soporte para múltiples fuentes de conocimiento** con interfaz dinámica.

### Stack Tecnológico
- **Lenguaje**: JavaScript ES6+ (Modules)
- **WebSockets**: Socket.IO Client
- **Audio**: Web Audio API, AudioWorklet
- **UI**: HTML5 + CSS3 (sin frameworks)
- **Módulos**: ES6 Modules nativos
- **APIs**: Fetch API para comunicación REST
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
├── Knowledge Source Management (NUEVO)
│   ├── Source Selector
│   ├── SharePoint Controls
│   └── Status Management
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
- **Gestión de fuentes de conocimiento**
- **Control de SharePoint Knowledge Base**

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

// Gestión de fuentes de conocimiento (NUEVO)
let currentKnowledgeSource = 'bedrock';

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

### 4. Gestión de Fuentes de Conocimiento (NUEVO)
Sistema completo para manejar múltiples fuentes de conocimiento.

**Componentes:**
```javascript
// Elementos del DOM
const knowledgeSourceSelect = document.getElementById('knowledge-source');
const updateSharePointButton = document.getElementById('update-sharepoint');
const checkStatusButton = document.getElementById('check-status');
const knowledgeStatusDiv = document.getElementById('knowledge-status');

// Funciones principales
knowledgeSourceSelect.addEventListener('change', handleKnowledgeSourceChange);
updateSharePointButton.addEventListener('click', updateSharePointKB);
checkStatusButton.addEventListener('click', checkSharePointStatus);
```

### 5. Subida de PDFs (`public/src/pdf-upload.js`)
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
        <h1>Habla con Sonic</h1>
        <p>Powered by Codster</p>
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

#### 5. Knowledge Source Selection (NUEVA SECCIÓN)
**Propósito**: Selección y gestión de fuentes de conocimiento
**Componentes**:
```html
<div class="knowledge-section">
    <div class="section-header">
        <h2><i class="fas fa-database"></i> Fuente de Conocimiento</h2>
        <p>Selecciona la fuente de información que Sonic usará</p>
    </div>
    
    <div class="knowledge-card">
        <div class="knowledge-selector">
            <label for="knowledge-source" class="selector-label">
                <i class="fas fa-brain"></i>
                Fuente de Conocimiento:
            </label>
            <select id="knowledge-source" class="knowledge-dropdown">
                <option value="bedrock">Bedrock Knowledge Base</option>
                <option value="sharepoint">SharePoint Documents</option>
            </select>
        </div>
        
        <div class="knowledge-actions">
            <button id="update-sharepoint" class="btn btn-info">
                <i class="fas fa-sync-alt"></i>
                <span>Actualizar SharePoint</span>
            </button>
            <button id="check-status" class="btn btn-outline">
                <i class="fas fa-info-circle"></i>
                <span>Ver Estado</span>
            </button>
        </div>
        
        <div id="knowledge-status" class="knowledge-status hidden">
            <!-- Status info will be populated here -->
        </div>
    </div>
</div>
```

#### 6. PDF Upload Section
**Funcionalidad**:
- Selector de archivos con drag & drop visual
- Indicador de progreso
- Feedback de estado de sincronización

### Estilos CSS (`public/src/style.css`)
**Características del diseño:**
- Diseño responsive y moderno
- Gradientes y efectos visuales sofisticados
- Animaciones y transiciones suaves
- Iconografía con Font Awesome
- Estados visuales claros

**Nuevos Estilos para Knowledge Source:**
```css
/* Knowledge Source Section */
.knowledge-section {
    padding: 30px;
    background: linear-gradient(45deg, #f0f8ff 0%, #e6f3ff 100%);
    border-top: 1px solid rgba(102, 126, 234, 0.1);
}

.knowledge-dropdown {
    width: 100%;
    padding: 12px 16px;
    border: 2px solid #e0e7ff;
    border-radius: 10px;
    font-size: 1rem;
    background: white;
    color: #333;
    transition: all 0.3s ease;
    cursor: pointer;
}

.knowledge-dropdown:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}
```

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

#### 1. `promptStart` - **ACTUALIZADO**
**Timing**: Al inicializar sesión
**Propósito**: Señalar inicio de nueva conversación **con fuente de conocimiento**
**Datos**: Objeto con `knowledgeSource`

```javascript
// Nueva implementación
socket.emit('promptStart', { knowledgeSource: currentKnowledgeSource });
```

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

#### 6. `setKnowledgeSource` - **NUEVO**
**Timing**: Cuando el usuario cambia la fuente
**Propósito**: Cambiar dinámicamente la fuente de conocimiento
**Datos**: `{ source: 'bedrock' | 'sharepoint' }`

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

#### 5. `knowledgeSourceSet` - **NUEVO**
**Respuesta**: Confirmación de cambio de fuente de conocimiento
**Acción**: Actualizar UI y estado local

#### 6. `error`
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

## Gestión de Fuentes de Conocimiento

### Selector de Fuente (NUEVO)

#### Variables de Estado
```javascript
let currentKnowledgeSource = 'bedrock'; // Estado global de la fuente
```

#### Event Handlers
```javascript
// Cambio de fuente de conocimiento
knowledgeSourceSelect.addEventListener('change', (e) => {
    currentKnowledgeSource = e.target.value;
    console.log(`Knowledge source changed to: ${currentKnowledgeSource}`);
    
    // Update button visibility based on selection
    if (currentKnowledgeSource === 'sharepoint') {
        updateSharePointButton.style.display = 'flex';
        checkStatusButton.style.display = 'flex';
    } else {
        updateSharePointButton.style.display = 'none';
        checkStatusButton.style.display = 'none';
        knowledgeStatusDiv.classList.add('hidden');
    }
});
```

#### Inicialización de Sesión con Fuente
```javascript
async function initializeSession() {
    try {
        // Send events in sequence with knowledge source
        socket.emit('promptStart', { knowledgeSource: currentKnowledgeSource });
        socket.emit('systemPrompt', SYSTEM_PROMPT);
        socket.emit('audioStart');

        sessionInitialized = true;
        console.log(`Session initialized with ${currentKnowledgeSource} knowledge source`);
    } catch (error) {
        console.error("Failed to initialize session:", error);
    }
}
```

### UI Dinámica
- **Bedrock seleccionado**: Oculta botones de SharePoint
- **SharePoint seleccionado**: Muestra botones de actualización y estado
- **Transiciones suaves**: Animaciones CSS para cambios de estado

## Gestión de SharePoint

### Actualización de Knowledge Base

#### Función de Actualización
```javascript
updateSharePointButton.addEventListener('click', async () => {
    const button = updateSharePointButton;
    const icon = button.querySelector('i');
    const span = button.querySelector('span');
    
    // Show loading state
    button.classList.add('loading');
    icon.className = 'fas fa-spinner';
    span.textContent = 'Actualizando...';
    button.disabled = true;
    
    try {
        const response = await fetch('/api/sharepoint/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showKnowledgeStatus(`✅ SharePoint actualizado: ${result.updated} documentos procesados`, 'success');
            // Auto-refresh status after update
            setTimeout(() => checkSharePointStatus(), 1000);
        } else {
            showKnowledgeStatus(`❌ Error: ${result.message}`, 'error');
        }
    } catch (error) {
        console.error('Error updating SharePoint:', error);
        showKnowledgeStatus(`❌ Error de conexión: ${error.message}`, 'error');
    } finally {
        // Reset button state
        button.classList.remove('loading');
        icon.className = 'fas fa-sync-alt';
        span.textContent = 'Actualizar SharePoint';
        button.disabled = false;
    }
});
```

### Verificación de Estado

#### Función de Estado
```javascript
async function checkSharePointStatus() {
    try {
        const response = await fetch('/api/sharepoint/status');
        const result = await response.json();
        
        if (result.success) {
            displaySharePointStatus(result.status);
        } else {
            showKnowledgeStatus(`❌ Error: ${result.message}`, 'error');
        }
    } catch (error) {
        console.error('Error checking SharePoint status:', error);
        showKnowledgeStatus(`❌ Error de conexión: ${error.message}`, 'error');
    }
}
```

#### Visualización de Estado
```javascript
function displaySharePointStatus(status) {
    const lastSync = new Date(status.lastSync).toLocaleString('es-ES');
    
    knowledgeStatusDiv.innerHTML = `
        <h3><i class="fas fa-info-circle"></i> Estado de SharePoint Knowledge Base</h3>
        <div class="status-info">
            <div class="status-item documents">
                <h4>Documentos</h4>
                <p>${status.documentCount}</p>
            </div>
            <div class="status-item size">
                <h4>Tamaño Total</h4>
                <p>${status.formattedSize}</p>
            </div>
            <div class="status-item sync">
                <h4>Última Sincronización</h4>
                <p>${lastSync}</p>
            </div>
        </div>
    `;
    knowledgeStatusDiv.classList.remove('hidden');
}
```

### Estados de Botones
- **Loading State**: Spinner animado durante operaciones
- **Success State**: Feedback visual positivo
- **Error State**: Mensajes de error claros
- **Disabled State**: Prevención de múltiples clicks

## Subida de PDFs

### Flujo de Subida
1. **Validación**: Verificar tipo de archivo (PDF únicamente)
2. **Preparación**: Crear FormData con el archivo
3. **Upload**: POST request a `/api/upload`
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

### 2. Selección de Fuente de Conocimiento (NUEVO)
```
Usuario selecciona fuente → UI se actualiza → Configuración se guarda → Botones se muestran/ocultan
```

### 3. Actualización de SharePoint (NUEVO)
```
Click "Actualizar SharePoint" → Loading state → API call → Procesamiento → Success/Error feedback
```

### 4. Conversación
```
Click Start → Seleccionar fuente → Inicializar sesión → Comenzar streaming → 
Capturar audio → Recibir transcripción → Mostrar respuesta → Audio del asistente → 
Finalizar turno
```

### 5. Verificación de Estado (NUEVO)
```
Click "Ver Estado" → API call → Mostrar estadísticas → Información de documentos
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

### Estados de Knowledge Base (NUEVOS)
- **`bedrock-selected`**: Usando Bedrock Knowledge Base
- **`sharepoint-selected`**: Usando SharePoint Knowledge Base
- **`updating-sharepoint`**: Actualizando SharePoint KB
- **`checking-status`**: Verificando estado de SharePoint

### Indicadores Visuales
```javascript
// Indicador de usuario pensando
function showUserThinkingIndicator() {
    userThinkingIndicator = document.createElement('div');
    userThinkingIndicator.className = 'message user thinking';
    
    const listeningText = document.createElement('div');
    listeningText.className = 'thinking-text';
    listeningText.textContent = 'Listening';
    
    const dotContainer = document.createElement('div');
    dotContainer.className = 'thinking-dots';
    
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('span');
        dot.className = 'dot';
        dotContainer.appendChild(dot);
    }
    
    userThinkingIndicator.appendChild(listeningText);
    userThinkingIndicator.appendChild(dotContainer);
    chatContainer.appendChild(userThinkingIndicator);
}
```

## Compatibilidad de Navegadores

### Requisitos Mínimos
- **Chrome**: v91+
- **Firefox**: v90+
- **Safari**: v14+
- **Edge**: v91+

### APIs Requeridas
- Web Audio API
- MediaDevices.getUserMedia()
- WebSocket/Socket.IO
- Fetch API
- ES6+ (Modules, Async/Await, Arrow Functions)

### Fallbacks y Polyfills
- **AudioWorklet**: Fallback a ScriptProcessorNode en navegadores legacy
- **Fetch**: Polyfill incluido para compatibilidad extendida

## Funcionalidades Avanzadas

### 1. Gestión de Estado Reactiva
- **Singleton Pattern**: ChatHistoryManager
- **Event-driven**: Actualización automática de UI
- **State Management**: Variables globales centralizadas

### 2. Optimización de Performance
- **Lazy Loading**: Carga diferida de componentes
- **Debouncing**: Prevención de múltiples calls API
- **Memory Management**: Limpieza automática de audio buffers

### 3. Experiencia de Usuario
- **Loading States**: Feedback visual en todas las operaciones
- **Error Handling**: Mensajes de error amigables
- **Responsive Design**: Adaptación a diferentes tamaños de pantalla
- **Accessibility**: Soporte básico para lectores de pantalla

### 4. Integración Multi-plataforma
- **REST APIs**: Comunicación con múltiples servicios
- **WebSocket**: Comunicación en tiempo real
- **File Upload**: Soporte para múltiples tipos de archivo
- **Status Polling**: Monitoreo de procesos asincrónicos

## Estructura de Archivos

```
public/
├── index.html              # Estructura principal de la UI
├── src/
│   ├── main.js             # Controlador principal + Knowledge management
│   ├── pdf-upload.js       # Funcionalidad de upload de PDFs
│   ├── style.css           # Estilos completos + Knowledge styles
│   └── lib/
│       ├── play/
│       │   ├── AudioPlayer.js                    # Sistema de reproducción
│       │   └── AudioPlayerProcessor.worklet.js   # Audio worklet processor
│       └── util/
│           ├── ChatHistoryManager.js             # Gestión de chat
│           └── ObjectsExt.js                     # Utilidades
└── pdf_files/              # Archivos PDF estáticos
```

## Configuración de Desarrollo

### Servidor de Desarrollo
El frontend se sirve estáticamente desde el servidor Node.js:

```javascript
// Configuración en server.ts
app.use(express.static(config.server.publicDir));
```

### Variables de Configuración
```javascript
// Configuración del sistema de audio
const TARGET_SAMPLE_RATE = 16000;
const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');

// Configuración de prompt del sistema
let SYSTEM_PROMPT = "Saluda al usuario. Debes dar respuestas cortas y concisas, no mas de ttres lineas.";

// Configuración de fuente de conocimiento
let currentKnowledgeSource = 'bedrock';
```

### Testing y Debugging
- **Console Logging**: Logging comprehensivo en todas las operaciones
- **Error Boundaries**: Manejo de errores en cada componente
- **Estado Visual**: Indicadores claros del estado del sistema
- **Network Monitoring**: Logs de todas las comunicaciones WebSocket y REST