# Documentación del Backend - Amazon Nova Sonic TypeScript Server

## Tabla de Contenidos
- [Arquitectura General](#arquitectura-general)
- [Componentes Principales](#componentes-principales)
- [Configuración](#configuración)
- [APIs y Rutas](#apis-y-rutas)
- [Manejo de WebSockets](#manejo-de-websockets)
- [Gestión de Fuentes de Conocimiento](#gestión-de-fuentes-de-conocimiento)
- [Integración con AWS](#integración-con-aws)
- [Integración con SharePoint](#integración-con-sharepoint)
- [Gestión de Sesiones](#gestión-de-sesiones)
- [Flujo de Datos](#flujo-de-datos)
- [Manejo de Errores](#manejo-de-errores)

## Arquitectura General

El backend está construido con Node.js y TypeScript, utilizando Express.js como framework web y Socket.IO para comunicación en tiempo real. La arquitectura sigue un patrón de microservicios con separación clara de responsabilidades y **soporte para múltiples fuentes de conocimiento**.

### Stack Tecnológico
- **Runtime**: Node.js
- **Lenguaje**: TypeScript
- **Framework Web**: Express.js
- **WebSockets**: Socket.IO
- **AWS SDK**: @aws-sdk/client-bedrock-runtime, @aws-sdk/client-s3, @aws-sdk/client-bedrock-agent
- **SharePoint SDK**: @azure/msal-node, pdf-parse
- **Gestión de Archivos**: Multer
- **Variables de Entorno**: dotenv

### Arquitectura de Fuentes de Conocimiento
```
Knowledge Sources
├── AWS Bedrock Knowledge Base
│   ├── Bedrock Agent Client
│   ├── Vector Search
│   └── RAG Generation
└── SharePoint Documents
    ├── MSAL Authentication
    ├── Document Download
    ├── Text Extraction
    └── Local Search Engine
```

## Componentes Principales

### 1. Server Principal (`src/server.ts`)
El servidor principal maneja las conexiones WebSocket y sirve archivos estáticos.

**Funcionalidades Clave:**
- Inicialización del servidor Express
- Configuración de Socket.IO
- Manejo de conexiones de clientes
- Gestión del ciclo de vida de sesiones
- **Selector dinámico de fuente de conocimiento**
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
Maneja la comunicación bidireccional con Amazon Nova Sonic y **gestión de múltiples fuentes de conocimiento**.

**Funcionalidades Principales:**
- Gestión de sesiones de streaming
- Manejo de eventos de audio y texto
- Procesamiento de respuestas del modelo
- **Control dinámico de herramientas (tool use)**
- **Selector de fuente de conocimiento por sesión**

**Nuevas Funcionalidades:**
```typescript
// Selector de fuente de conocimiento
public setKnowledgeSource(sessionId: string, source: 'bedrock' | 'sharepoint'): void

// Consulta a Bedrock Knowledge Base
private async queryBenefitPolicy(query: string, numberOfResults: number = 3): Promise<Object>

// Consulta a SharePoint Knowledge Base
private async querySharePointKnowledge(query: string, numberOfResults: number = 5): Promise<Object>
```

### 3. SharePoint Storage (`src/sharepoint-storage.ts`)
**Nuevo componente** que maneja el almacenamiento y búsqueda local de documentos de SharePoint.

**Funcionalidades:**
- Descarga y procesamiento de PDFs desde SharePoint
- Almacenamiento local en JSON con metadatos
- Motor de búsqueda por relevancia
- Actualización incremental de documentos
- Gestión de estado y estadísticas

**Características Principales:**
```typescript
export class SharePointKnowledgeBase {
    // Actualiza la base de conocimiento desde SharePoint
    public async updateKnowledgeBase(): Promise<{ updated: number; total: number }>
    
    // Busca en la base de conocimiento local
    public async searchKnowledge(query: string, maxResults: number = 5): Promise<any[]>
    
    // Obtiene estado de la base de conocimiento
    public async getStatus(): Promise<{ documentCount: number; lastSync: Date; totalSize: number }>
}
```

### 4. SharePoint Client (`src/sharepoint-client.ts`)
Cliente para comunicación con SharePoint Online via Microsoft Graph API.

**Funcionalidades:**
- Autenticación con MSAL
- Descarga de documentos PDF
- Extracción de texto con pdf-parse
- Gestión de errores y reintentos

### 5. Configuración (`src/config.ts`)
Centraliza la gestión de configuración del sistema, **incluyendo SharePoint**.

**Variables de Configuración Actualizadas:**
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
    sharepoint: {
        tenantId: string;
        clientId: string;
        clientSecret: string;
        siteUrl: string;
    };
}
```

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

# SharePoint Configuration (NUEVO)
SHAREPOINT_TENANT_ID=your_tenant_id
SHAREPOINT_CLIENT_ID=your_client_id
SHAREPOINT_CLIENT_SECRET=your_client_secret
SHAREPOINT_SITE_URL=https://your-tenant.sharepoint.com/sites/your-site

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

#### 2. SharePoint Knowledge Base (`/api/sharepoint`) - **NUEVAS RUTAS**

##### 2.1 Actualizar SharePoint KB
**Endpoint**: `POST /api/sharepoint/update`
**Funcionalidad**: Actualiza la base de conocimiento de SharePoint

**Respuesta:**
```json
{
    "success": true,
    "message": "SharePoint knowledge base updated successfully",
    "updated": 15,
    "total": 15
}
```

##### 2.2 Estado de SharePoint KB
**Endpoint**: `GET /api/sharepoint/status`
**Funcionalidad**: Obtiene el estado actual de la KB de SharePoint

**Respuesta:**
```json
{
    "success": true,
    "status": {
        "documentCount": 15,
        "lastSync": "2023-12-07T10:30:00.000Z",
        "totalSize": 2048576,
        "formattedSize": "2.0 MB"
    }
}
```

##### 2.3 Listar Documentos
**Endpoint**: `GET /api/sharepoint/documents`
**Funcionalidad**: Lista los documentos disponibles en SharePoint KB

**Respuesta:**
```json
{
    "success": true,
    "documents": [
        "Employee_Handbook.pdf",
        "Benefits_Guide.pdf",
        "IT_Policies.pdf"
    ]
}
```

##### 2.4 Búsqueda en SharePoint
**Endpoint**: `POST /api/sharepoint/search`
**Funcionalidad**: Búsqueda directa en SharePoint KB (para testing)

**Parámetros:**
```json
{
    "query": "vacation policy",
    "maxResults": 5
}
```

**Respuesta:**
```json
{
    "success": true,
    "query": "vacation policy",
    "results": [
        {
            "fileName": "Employee_Handbook.pdf",
            "excerpt": "...vacation policy allows for 15 days...",
            "relevanceScore": 8.5
        }
    ]
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

#### 2. `promptStart` - **ACTUALIZADO**
**Propósito**: Inicia una nueva conversación **con fuente de conocimiento**
**Funcionalidad**: Configura el inicio del prompt con la fuente seleccionada

**Nuevo formato:**
```typescript
socket.on('promptStart', async (data) => {
    const knowledgeSource = data?.knowledgeSource || 'bedrock';
    await session.setupPromptStart(knowledgeSource);
});
```

#### 3. `systemPrompt`
**Propósito**: Establece el prompt del sistema
**Parámetros**: String con las instrucciones del sistema

#### 4. `audioStart`
**Propósito**: Inicia el streaming de audio
**Funcionalidad**: Prepara la sesión para recibir audio

#### 5. `stopAudio`
**Propósito**: Detiene el streaming y cierra la sesión
**Funcionalidad**: Ejecuta secuencia de cierre limpio

#### 6. `setKnowledgeSource` - **NUEVO**
**Propósito**: Cambia la fuente de conocimiento durante la sesión
**Parámetros**: `{ source: 'bedrock' | 'sharepoint' }`
**Respuesta**: `knowledgeSourceSet` event

```typescript
socket.on('setKnowledgeSource', (data) => {
    const { source } = data;
    bedrockClient.setKnowledgeSource(sessionId, source);
    socket.emit('knowledgeSourceSet', { source });
});
```

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

#### 5. `knowledgeSourceSet` - **NUEVO**
**Propósito**: Confirma el cambio de fuente de conocimiento
**Formato**:
```json
{
    "source": "bedrock|sharepoint"
}
```

#### 6. `error`
**Propósito**: Reporta errores al cliente
**Formato**:
```json
{
    "message": "Descripción del error",
    "details": "Detalles técnicos"
}
```

## Gestión de Fuentes de Conocimiento

### Sistema Dual de Knowledge Base

El sistema ahora soporta **dos fuentes de conocimiento independientes**:

#### 1. AWS Bedrock Knowledge Base
- **Ubicación**: AWS Bedrock Agent
- **Tipo**: Vector database managed
- **Búsqueda**: Vector similarity search
- **Herramienta**: `retrieve_benefit_policy`
- **Uso**: Políticas empresariales, beneficios, información estructurada

#### 2. SharePoint Documents Knowledge Base
- **Ubicación**: Local storage (JSON)
- **Tipo**: Text-based search engine
- **Búsqueda**: Term frequency + relevance scoring
- **Herramienta**: `retrieve_sharepoint_knowledge`
- **Uso**: Documentos corporativos, políticas de SharePoint

### Configuración de Herramientas Dinámicas

```typescript
// Configuración para Bedrock
const bedrockToolConfig = {
    toolChoice: { tool: { name: "retrieve_benefit_policy" } },
    tools: [{
        toolSpec: {
            name: "retrieve_benefit_policy",
            description: "Retrieves company benefit policy from Bedrock Knowledge Base",
            inputSchema: { json: KnowledgeBaseToolSchema }
        }
    }]
};

// Configuración para SharePoint
const sharepointToolConfig = {
    toolChoice: { tool: { name: "retrieve_sharepoint_knowledge" } },
    tools: [{
        toolSpec: {
            name: "retrieve_sharepoint_knowledge", 
            description: "Retrieves information from SharePoint documents",
            inputSchema: { json: SharePointToolSchema }
        }
    }]
};
```

### Flujo de Procesamiento de Herramientas

```typescript
private async processToolUse(toolName: string, toolUseContent: object): Promise<Object> {
    const tool = toolName.toLowerCase();

    switch (tool) {
        case "retrieve_benefit_policy":
            return this.queryBenefitPolicy(query, maxResults);
        
        case "retrieve_sharepoint_knowledge":
            return this.querySharePointKnowledge(query, maxResults);
        
        default:
            throw new Error(`Tool ${tool} not supported`);
    }
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

## Integración con SharePoint

### 1. Autenticación Microsoft Graph
```typescript
const msalApp = new ConfidentialClientApplication({
    auth: {
        clientId: config.sharepoint.clientId,
        authority: `https://login.microsoftonline.com/${config.sharepoint.tenantId}`,
        clientSecret: config.sharepoint.clientSecret
    }
});
```

### 2. Descarga de Documentos
- **API**: Microsoft Graph API v1.0
- **Filtro**: Solo archivos PDF
- **Procesamiento**: Extracción de texto en memoria

### 3. Almacenamiento Local
- **Formato**: JSON con metadatos
- **Ubicación**: `data/sharepoint-knowledge.json`
- **Estructura**:
```json
{
    "documents": [
        {
            "fileName": "documento.pdf",
            "text": "contenido extraído...",
            "lastUpdated": "2023-12-07T10:30:00.000Z",
            "size": 12345
        }
    ],
    "lastSync": "2023-12-07T10:30:00.000Z"
}
```

### 4. Motor de Búsqueda
- **Algoritmo**: Term frequency + position weighting
- **Scoring**: Relevance score basado en coincidencias
- **Excerpts**: Contexto automático alrededor de matches

## Gestión de Sesiones

### Ciclo de Vida de Sesión
1. **Creación**: Al conectarse un cliente WebSocket
2. **Configuración de KB**: Selección de fuente de conocimiento
3. **Inicialización**: Con `promptStart` y `systemPrompt`
4. **Streaming**: Durante `audioInput` activo
5. **Cierre**: Con `stopAudio` o desconexión

### Datos de Sesión Expandidos
```typescript
interface SessionData {
    // ... campos existentes ...
    knowledgeSource: 'bedrock' | 'sharepoint'; // NUEVO CAMPO
}
```

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

## Flujo de Datos

### 1. Flujo de Audio (sin cambios)
```
Cliente → Socket.IO → Server → Bedrock Client → Nova Sonic
    ↑                                                    ↓
    ←  Audio Response  ←  Server  ←  Bedrock Client  ←
```

### 2. Flujo de Conocimiento (NUEVO)
```
User Query → Nova Sonic → Tool Selection → Knowledge Source
                                        ↓
                            Bedrock KB ←→ SharePoint KB
                                        ↓
                            Results → Nova Sonic → Response
```

### 3. Flujo de Subida de PDF (sin cambios)
```
Cliente → Multer → S3 Upload → Knowledge Base Sync → Respuesta
```

### 4. Flujo de SharePoint (NUEVO)
```
Update Request → SharePoint Client → Download PDFs → Extract Text → Store Local → Response
```

## Manejo de Errores

### Estrategias de Error

#### 1. Validación de Configuración
- Verificación al startup
- Exit del proceso si falla

#### 2. Errores de Streaming
- Captura de excepciones en handlers
- Emisión de eventos de error al cliente

#### 3. Errores de SharePoint (NUEVO)
- Reintentos automáticos en fallos de red
- Fallback a cache local
- Logging detallado de errores de autenticación

#### 4. Errores de Knowledge Base
- Timeout handling para consultas largas
- Respuestas de fallback cuando no hay resultados
- Logging de performance de consultas

### Logging y Monitoreo
```typescript
// Ejemplo de logging estructurado
console.log(`Knowledge source set to ${source} for session ${sessionId}`);
console.log(`Searching ${source} KB for: "${query}"`);
console.log(`SharePoint KB updated: ${result.updated} documents`);
```

## Métricas y Performance

### Nuevas Métricas
- **Knowledge Source Usage**: Tracking de uso por fuente
- **SharePoint Sync Performance**: Tiempo de sincronización
- **Search Performance**: Tiempo de respuesta por fuente
- **Document Processing**: Velocidad de extracción de texto

### Optimizaciones
- **Caching**: Resultados de búsqueda en memoria
- **Lazy Loading**: Carga diferida de documentos grandes
- **Batch Processing**: Procesamiento por lotes de PDFs 