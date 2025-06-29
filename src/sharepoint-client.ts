import { ConfidentialClientApplication, AuthenticationResult } from '@azure/msal-node';
import axios, { AxiosResponse } from 'axios';
import pdfParse from 'pdf-parse';

/**
 * Configuration for SharePoint authentication and access
 */
interface SharePointConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  siteUrl: string;
}

/**
 * SharePoint file information
 */
interface SharePointFile {
  id: string;
  name: string;
  webUrl: string;
  size: number;
}

/**
 * SharePoint Graph API response for files
 */
interface GraphFilesResponse {
  value: Array<{
    id: string;
    name: string;
    webUrl: string;
    size: number;
  }>;
}

/**
 * SharePoint Graph API response for drives
 */
interface GraphDrivesResponse {
  value: Array<{
    id: string;
    name: string;
  }>;
}

/**
 * SharePoint Graph API response for site
 */
interface GraphSiteResponse {
  id: string;
  name: string;
}

/**
 * SharePoint client for downloading and processing PDF files
 */
export class SharePointClient {
  private config: SharePointConfig;
  private msalApp: ConfidentialClientApplication;
  private accessToken: string | null = null;

  constructor(config: SharePointConfig) {
    this.config = config;

    // Create MSAL application
    this.msalApp = new ConfidentialClientApplication({
      auth: {
        clientId: this.config.clientId,
        authority: `https://login.microsoftonline.com/${this.config.tenantId}`,
        clientSecret: this.config.clientSecret
      }
    });
  }

  /**
   * Acquire access token for Microsoft Graph API
   */
  private async acquireToken(): Promise<string> {
    try {
      const result: AuthenticationResult | null = await this.msalApp.acquireTokenByClientCredential({
        scopes: ['https://graph.microsoft.com/.default']
      });

      if (result && result.accessToken) {
        this.accessToken = result.accessToken;
        console.log('✅ Token Graph obtenido correctamente.');
        return result.accessToken;
      } else {
        throw new Error('No se pudo obtener el token de acceso');
      }
    } catch (error) {
      console.error('❌ Error al obtener el token Graph:', error);
      throw error;
    }
  }

  /**
   * Get SharePoint site ID
   */
  private async getSiteId(): Promise<string> {
    const token = this.accessToken || await this.acquireToken();
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    };

    try {
      // Extract site path from URL
      const siteUrl = new URL(this.config.siteUrl);
      const sitePath = siteUrl.pathname;
      
      const siteApiUrl = `https://graph.microsoft.com/v1.0/sites/${siteUrl.hostname}:${sitePath}`;
      const response: AxiosResponse<GraphSiteResponse> = await axios.get(siteApiUrl, { headers });
      
      if (response.status !== 200) {
        throw new Error(`Error al obtener sitio: ${response.status}`);
      }

      return response.data.id;
    } catch (error) {
      console.error('❌ Error al obtener el ID del sitio:', error);
      throw error;
    }
  }

  /**
   * Get document library ID
   */
  private async getLibraryId(siteId: string): Promise<string> {
    const token = this.accessToken || await this.acquireToken();
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    };

    try {
      const libraryApiUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives`;
      const response: AxiosResponse<GraphDrivesResponse> = await axios.get(libraryApiUrl, { headers });
      
      if (response.status !== 200) {
        throw new Error(`Error al obtener drives: ${response.status}`);
      }

      const drives = response.data.value;
      const documentsLibrary = drives.find(d => d.name === 'Documents');
      
      if (!documentsLibrary) {
        throw new Error("No se encontró la biblioteca 'Documents'");
      }

      return documentsLibrary.id;
    } catch (error) {
      console.error('❌ Error al obtener el ID de la biblioteca:', error);
      throw error;
    }
  }

  /**
   * List PDF files in the document library
   */
  private async listPdfFiles(libraryId: string): Promise<SharePointFile[]> {
    const token = this.accessToken || await this.acquireToken();
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    };

    try {
      const filesApiUrl = `https://graph.microsoft.com/v1.0/drives/${libraryId}/root/children`;
      const response: AxiosResponse<GraphFilesResponse> = await axios.get(filesApiUrl, { headers });
      
      if (response.status !== 200) {
        throw new Error(`Error al listar archivos: ${response.status}`);
      }

      if (!response.data.value) {
        console.log('❌ No se encontraron archivos');
        return [];
      }

      // Filter only PDF files
      const pdfFiles = response.data.value.filter(file => 
        file.name.toLowerCase().endsWith('.pdf')
      );

      return pdfFiles.map(file => ({
        id: file.id,
        name: file.name,
        webUrl: file.webUrl,
        size: file.size
      }));
    } catch (error) {
      console.error('❌ Error al listar archivos:', error);
      throw error;
    }
  }

  /**
   * Download a file from SharePoint and return as buffer
   */
  private async downloadFileBuffer(libraryId: string, fileId: string, fileName: string): Promise<Buffer> {
    const token = this.accessToken || await this.acquireToken();
    const headers = {
      'Authorization': `Bearer ${token}`
    };

    try {
      const downloadUrl = `https://graph.microsoft.com/v1.0/drives/${libraryId}/items/${fileId}/content`;
      const response = await axios.get(downloadUrl, { 
        headers, 
        responseType: 'arraybuffer' 
      });

      if (response.status !== 200) {
        throw new Error(`Error al descargar ${fileName}: ${response.status}`);
      }

      console.log(`✅ Descargado en memoria: ${fileName}`);
      return Buffer.from(response.data);
    } catch (error) {
      console.error(`❌ Error al descargar ${fileName}:`, error);
      throw error;
    }
  }

  /**
   * Extract text from PDF buffer
   */
  private async extractTextFromPdfBuffer(buffer: Buffer, fileName: string): Promise<string> {
    try {
      const data = await pdfParse(buffer);
      return data.text;
    } catch (error) {
      console.error(`❌ Error al extraer texto del PDF ${fileName}:`, error);
      throw error;
    }
  }

  /**
   * Download and process all PDF files from SharePoint
   */
  public async downloadAndProcessPdfs(): Promise<Array<{ fileName: string; text: string }>> {
    console.log('🚀 Iniciando descarga y procesamiento de PDFs desde SharePoint...');
    
    try {
      // Get access token
      await this.acquireToken();

      // Get site ID
      const siteId = await this.getSiteId();
      console.log(`📁 ID del sitio obtenido: ${siteId}`);

      // Get library ID
      const libraryId = await this.getLibraryId(siteId);
      console.log(`📚 ID de la biblioteca obtenido: ${libraryId}`);

      // List PDF files
      const pdfFiles = await this.listPdfFiles(libraryId);
      console.log(`📄 Encontrados ${pdfFiles.length} archivos PDF`);

      if (pdfFiles.length === 0) {
        console.log('ℹ️ No se encontraron archivos PDF para procesar');
        return [];
      }

      // Download and process each PDF
      const results: Array<{ fileName: string; text: string }> = [];

      for (const file of pdfFiles) {
        try {
          console.log(`⬇️ Procesando: ${file.name}`);
          const buffer = await this.downloadFileBuffer(libraryId, file.id, file.name);
          
          console.log(`📖 Extrayendo texto de: ${file.name}`);
          const text = await this.extractTextFromPdfBuffer(buffer, file.name);
          
          results.push({
            fileName: file.name,
            text: text
          });

          // Show preview of extracted text
          const preview = text.substring(0, 500);
          console.log(`📄 Texto extraído de ${file.name}:\n${preview}${text.length > 500 ? '...' : ''}\n`);
          
        } catch (error) {
          console.error(`❌ Error procesando ${file.name}:`, error);
          // Continue with next file
        }
      }

      console.log(`✅ Procesamiento completado. ${results.length} archivos procesados exitosamente.`);
      return results;

    } catch (error) {
      console.error('❌ Error en el procesamiento general:', error);
      throw error;
    }
  }

  /**
   * Get a specific PDF file by name
   */
  public async getSpecificPdf(fileName: string): Promise<{ fileName: string; text: string } | null> {
    try {
      await this.acquireToken();
      const siteId = await this.getSiteId();
      const libraryId = await this.getLibraryId(siteId);
      const pdfFiles = await this.listPdfFiles(libraryId);

      const targetFile = pdfFiles.find(file => 
        file.name.toLowerCase() === fileName.toLowerCase()
      );

      if (!targetFile) {
        console.log(`❌ Archivo ${fileName} no encontrado`);
        return null;
      }

      const buffer = await this.downloadFileBuffer(libraryId, targetFile.id, targetFile.name);
      const text = await this.extractTextFromPdfBuffer(buffer, targetFile.name);

      return {
        fileName: targetFile.name,
        text: text
      };

    } catch (error) {
      console.error(`❌ Error obteniendo archivo ${fileName}:`, error);
      throw error;
    }
  }
}

// Export default for easy import
export default SharePointClient; 