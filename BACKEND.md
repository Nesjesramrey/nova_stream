# Documentación del Backend - Amazon Nova Sonic TypeScript Server

## Tabla de Contenidos
- [Arquitectura General](#arquitectura-general)
- [Componentes Principales](#componentes-principales)
- [Configuración](#configuración)
- [APIs y Rutas](#apis-y-rutas)
- [Manejo de WebSockets](#manejo-de-websockets)
- [Integración con AWS](#integración-con-aws)
- [Gestión de Sesiones](#gestión-de-sesiones)
- [Flujo de Datos](#flujo-de-datos)
- [Manejo de Errores](#manejo-de-errores)

## Arquitectura General

El backend está construido con Node.js y TypeScript, utilizando Express.js como framework web y Socket.IO para comunicación en tiempo real. La arquitectura sigue un patrón de microservicios con separación clara de responsabilidades.

### Stack Tecnológico
- **Runtime**: Node.js
- **Lenguaje**: TypeScript
- **Framework Web**: Express.js
- **WebSockets**: Socket.IO
- **AWS SDK**: @aws-sdk/client-bedrock-runtime, @aws-sdk/client-s3
- **Gestión de Archivos**: Multer
- **Variables de Entorno**: dotenv

## Componentes Principales

### 1. Server Principal (`src/server.ts`)
El servidor principal maneja las conexiones WebSocket y sirve archivos estáticos.

**Funcionalidades Clave:**
- Inicialización del servidor Express
- Configuración de Socket.IO
- Manejo de conexiones de clientes
- Gestión del ciclo de vida de sesiones
- Limpieza automática de sesiones inactivas

**Características:**
```typescript
// Creación del servidor
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Cliente Bedrock
const bedrockClient = new NovaSonicBidirectionalStreamClient({
    requestHandlerConfig: {
        maxConcurrentStreams: 10,
    },
    clientConfig: {
        region: config.aws.region,
        credentials: fromIni({ profile: config.aws.profile })
    }
});
```

### 2. Cliente Bedrock (`src/client.ts`)
Maneja la comunicación bidireccional con Amazon Nova Sonic.

**Funcionalidades:**
- Gestión de sesiones de streaming
- Manejo de eventos de audio y texto
- Procesamiento de respuestas del modelo
- Control de herramientas (tool use)

### 3. Configuración (`src/config.ts`)
Centraliza la gestión de configuración del sistema.

**Variables de Configuración:**
```typescript
export interface Config {
    aws: {
        region: string;
        profile: string;
    };
    server: {
        port: number;
        publicDir: string;
    };
    knowledgeBase: {
        id: string;
        dataSourceId: string;
    };
    s3: {
        bucketName: string;
    };
}
```

### 4. Tipos (`src/types.ts`)
Define las interfaces TypeScript para el tipado fuerte.

### 5. Cliente S3 y Knowledge Base (`src/s3-bedrock-client.ts`)
Maneja las operaciones de S3 y sincronización de Knowledge Base.

## Configuración

### Variables de Entorno Requeridas
```env
# Configuración AWS
AWS_REGION=us-east-1
AWS_PROFILE=bedrock-test

# Bedrock Knowledge Base
KNOWLEDGE_BASE_ID=your-knowledge-base-id
DATA_SOURCE_ID=your-data-source-id

# S3
S3_BUCKET_NAME=your-s3-bucket-name

# Servidor
PORT=3000
```

### Validación de Configuración
El sistema valida automáticamente todas las variables requeridas al inicio:

```typescript
try {
    validateConfig();
} catch (error) {
    console.error('Configuration error:', error.message);
    process.exit(1);
}
```

## APIs y Rutas

### Rutas REST

#### 1. Subida de PDFs (`/api/upload`)
**Endpoint**: `POST /api/upload`
**Funcionalidad**: Sube archivos PDF a S3 y sincroniza Knowledge Base

**Parámetros:**
- `pdfFile`: Archivo PDF (multipart/form-data)
- Tamaño máximo: 10MB

**Respuesta:**
```json
{
    "message": "PDF uploaded and knowledge base sync started successfully",
    "fileName": "documento.pdf",
    "syncJobId": "sync-job-12345"
}
```

### Archivos Estáticos
- **Ruta**: `/*`
- **Directorio**: `public/`
- **Funcionalidad**: Sirve la aplicación frontend

## Manejo de WebSockets

### Eventos de Cliente a Servidor

#### 1. `audioInput`
**Propósito**: Recibe datos de audio del cliente
**Formato**: Base64 string o Buffer
**Procesamiento**: Convierte a Buffer y envía al modelo Nova Sonic

```typescript
socket.on('audioInput', async (audioData) => {
    const audioBuffer = typeof audioData === 'string'
        ? Buffer.from(audioData, 'base64')
        : Buffer.from(audioData);
    
    await session.streamAudio(audioBuffer);
});
```

#### 2. `promptStart`
**Propósito**: Inicia una nueva conversación
**Funcionalidad**: Configura el inicio del prompt

#### 3. `systemPrompt`
**Propósito**: Establece el prompt del sistema
**Parámetros**: String con las instrucciones del sistema

#### 4. `audioStart`
**Propósito**: Inicia el streaming de audio
**Funcionalidad**: Prepara la sesión para recibir audio

#### 5. `stopAudio`
**Propósito**: Detiene el streaming y cierra la sesión
**Funcionalidad**: Ejecuta secuencia de cierre limpio

### Eventos de Servidor a Cliente

#### 1. `contentStart`
**Propósito**: Indica el inicio de contenido del asistente
**Datos**: Información del tipo de contenido

#### 2. `textOutput`
**Propósito**: Envía transcripción de texto
**Formato**: 
```json
{
    "text": "Transcripción del texto",
    "role": "user|assistant"
}
```

#### 3. `audioOutput`
**Propósito**: Envía audio sintetizado del asistente
**Formato**: Buffer de audio codificado

#### 4. `toolUse`
**Propósito**: Notifica uso de herramientas
**Datos**: Información de la herramienta utilizada

#### 5. `error`
**Propósito**: Reporta errores al cliente
**Formato**:
```json
{
    "message": "Descripción del error",
    "details": "Detalles técnicos"
}
```

## Integración con AWS

### 1. Amazon Bedrock
- **Modelo**: Amazon Nova Sonic
- **Tipo**: Bidirectional Streaming
- **Configuración**: Credenciales por perfil IAM

### 2. Amazon S3
- **Uso**: Almacenamiento de documentos PDF
- **Configuración**: Bucket configurado en variables de entorno

### 3. Bedrock Knowledge Base
- **Uso**: Indexación de documentos para RAG
- **Sincronización**: Automática después de subir PDFs

## Gestión de Sesiones

### Ciclo de Vida de Sesión
1. **Creación**: Al conectarse un cliente WebSocket
2. **Inicialización**: Con `promptStart` y `systemPrompt`
3. **Streaming**: Durante `audioInput` activo
4. **Cierre**: Con `stopAudio` o desconexión

### Limpieza Automática
El servidor implementa limpieza automática de sesiones inactivas:

```typescript
setInterval(() => {
    const now = Date.now();
    bedrockClient.getActiveSessions().forEach(sessionId => {
        const lastActivity = bedrockClient.getLastActivityTime(sessionId);
        if (now - lastActivity > 5 * 60 * 1000) {
            bedrockClient.forceCloseSession(sessionId);
        }
    });
}, 60000);
```

### Métricas de Conexión
Monitoreo cada minuto de conexiones activas:
```typescript
setInterval(() => {
    const connectionCount = Object.keys(io.sockets.sockets).length;
    console.log(`Active socket connections: ${connectionCount}`);
}, 60000);
```

## Flujo de Datos

### 1. Flujo de Audio
```
Cliente → Socket.IO → Server → Bedrock Client → Nova Sonic
    ↑                                                    ↓
    ←  Audio Response  ←  Server  ←  Bedrock Client  ←
```

### 2. Flujo de Subida de PDF
```
Cliente → Multer → S3 Upload → Knowledge Base Sync → Respuesta
```

### 3. Flujo de Sesión
```
Conexión → Crear Sesión → Configurar → Streaming → Cierre
```

## Manejo de Errores

### Estrategias de Error

#### 1. Validación de Configuración
- Verificación al startup
- Exit del proceso si falla

#### 2. Errores de Streaming
- Captura de excepciones en handlers
- Emisión de eventos de error al cliente
- Logging detallado

#### 3. Errores de Sesión
- Cleanup automático en caso de error
- Reintento de operaciones críticas

### Logging
El sistema implementa logging comprensivo:
- Eventos de conexión/desconexión
- Operaciones de streaming
- Errores y excepciones
- Métricas de rendimiento

## Consideraciones de Rendimiento

### 1. Concurrencia
- Máximo 10 streams concurrentes por cliente
- Gestión de memoria para buffers de audio

### 2. Optimizaciones
- Procesamiento de audio en chunks de 512 bytes
- Cleanup automático de recursos
- Rate limiting implícito por diseño

### 3. Escalabilidad
- Arquitectura basada en eventos
- Gestión eficiente de sesiones
- Separación de responsabilidades

## Seguridad

### 1. Autenticación AWS
- Credenciales por perfil IAM
- Rotación automática de tokens

### 2. Validación de Entrada
- Validación de tipos de archivo
- Límites de tamaño
- Sanitización de datos

### 3. Gestión de Recursos
- Timeout de sesiones
- Limits de memoria
- Cleanup automático 