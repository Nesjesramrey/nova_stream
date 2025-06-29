# SharePoint Client

Este módulo permite conectarse a SharePoint Online, descargar archivos PDF y extraer texto de los mismos utilizando Microsoft Graph API.

## Características

- ✅ Autenticación con Microsoft Graph API usando MSAL
- ✅ Procesamiento de archivos PDF desde SharePoint (en memoria)
- ✅ Extracción de texto de archivos PDF sin guardado local
- ✅ Procesamiento en lote de todos los PDFs
- ✅ Búsqueda de archivos específicos por nombre
- ✅ Manejo de errores robusto
- ✅ No requiere almacenamiento local de archivos

## Instalación

Las dependencias necesarias ya están incluidas en el proyecto:

```bash
npm install @azure/msal-node pdf-parse
npm install --save-dev @types/pdf-parse
```

## Configuración

### Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
# SharePoint Configuration
SHAREPOINT_TENANT_ID=your_tenant_id
SHAREPOINT_CLIENT_ID=your_client_id
SHAREPOINT_CLIENT_SECRET=your_client_secret
SHAREPOINT_SITE_URL=https://your-tenant.sharepoint.com/sites/your-site
```

### Configuración de Azure AD

1. Registra una aplicación en Azure AD
2. Obtén el `Tenant ID`, `Client ID` y `Client Secret`
3. Configura los permisos necesarios:
   - `Sites.Read.All`
   - `Files.Read.All`

## Uso

### Importar la clase

```typescript
import { SharePointClient } from './src/sharepoint-client';
```

### Crear una instancia

```typescript
const config = {
  tenantId: "your_tenant_id",
  clientId: "your_client_id",
  clientSecret: "your_client_secret",
  siteUrl: "https://your-tenant.sharepoint.com/sites/your-site"
};

const client = new SharePointClient(config);
```

### Descargar y procesar todos los PDFs

```typescript
const results = await client.downloadAndProcessPdfs();

results.forEach(result => {
  console.log(`Archivo: ${result.fileName}`);
  console.log(`Texto extraído: ${result.text.substring(0, 100)}...`);
});
```

### Obtener un PDF específico

```typescript
const result = await client.getSpecificPdf('mi-documento.pdf');

if (result) {
  console.log(`Texto del archivo: ${result.text}`);
} else {
  console.log('Archivo no encontrado');
}
```

## Pruebas

### Ejecutar la prueba de ejemplo

```bash
npm run test:sharepoint
```

### Ejecutar con ts-node

```bash
npx ts-node src/test-sharepoint.ts
```

## Estructura de Respuesta

```typescript
interface PdfResult {
  fileName: string;    // Nombre del archivo
  text: string;       // Texto extraído del PDF
}
```

## Manejo de Errores

El cliente maneja los siguientes tipos de errores:

- **Errores de autenticación**: Credenciales inválidas o permisos insuficientes
- **Errores de red**: Problemas de conectividad con SharePoint
- **Errores de archivo**: Archivos corruptos o no accesibles
- **Errores de extracción**: Problemas al procesar el PDF

## Características Avanzadas

### Filtrado de Archivos

El cliente filtra automáticamente solo archivos PDF (extensión `.pdf`).

### Gestión de Tokens

Los tokens de acceso se gestionan automáticamente y se reutilizan mientras sean válidos.

### Procesamiento en Memoria

Los archivos PDF se procesan directamente en memoria sin necesidad de almacenamiento local.

## Ejemplo Completo

```typescript
import { SharePointClient } from './src/sharepoint-client';

async function example() {
  const config = {
    tenantId: "your_tenant_id_here",
    clientId: "your_client_id_here", 
    clientSecret: "your_client_secret_here",
    siteUrl: "https://your-tenant.sharepoint.com/sites/your-site"
  };

  const client = new SharePointClient(config);

  try {
    // Procesar todos los PDFs
    const results = await client.downloadAndProcessPdfs();
    
    console.log(`Procesados ${results.length} archivos:`);
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.fileName} - ${result.text.length} caracteres`);
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

example();
```

## Integración con el Proyecto

El cliente puede integrarse fácilmente con:

- **Rutas de Express**: Para crear endpoints API
- **Socket.io**: Para actualizaciones en tiempo real
- **Base de Conocimiento AWS**: Para indexar el contenido extraído
- **Almacenamiento S3**: Para backup de archivos

## Seguridad

⚠️ **Importante**: 
- Nunca incluyas credenciales en el código fuente
- Usa variables de entorno para configuración sensible
- Implementa validación de entrada adecuada
- Considera implementar rate limiting para las llamadas API 