import fs from 'fs/promises';
import path from 'path';
import { SharePointClient } from './sharepoint-client';
import { config } from './config';

interface SharePointDocument {
  fileName: string;
  text: string;
  lastUpdated: Date;
  size: number;
}

interface SharePointStorage {
  documents: SharePointDocument[];
  lastSync: Date;
}

export class SharePointKnowledgeBase {
  private storageFile: string;
  private client: SharePointClient;

  constructor() {
    this.storageFile = path.join(__dirname, '../data/sharepoint-knowledge.json');
    this.client = new SharePointClient({
      tenantId: config.sharepoint.tenantId,
      clientId: config.sharepoint.clientId,
      clientSecret: config.sharepoint.clientSecret,
      siteUrl: config.sharepoint.siteUrl
    });
  }

  /**
   * Ensure data directory exists
   */
  private async ensureDataDirectory(): Promise<void> {
    const dataDir = path.dirname(this.storageFile);
    try {
      await fs.access(dataDir);
    } catch {
      await fs.mkdir(dataDir, { recursive: true });
    }
  }

  /**
   * Load existing storage or create empty one
   */
  private async loadStorage(): Promise<SharePointStorage> {
    try {
      const data = await fs.readFile(this.storageFile, 'utf-8');
      const storage = JSON.parse(data);
      // Convert date strings back to Date objects
      storage.lastSync = new Date(storage.lastSync);
      storage.documents.forEach((doc: any) => {
        doc.lastUpdated = new Date(doc.lastUpdated);
      });
      return storage;
    } catch {
      return {
        documents: [],
        lastSync: new Date(0) // Unix epoch
      };
    }
  }

  /**
   * Save storage to file
   */
  private async saveStorage(storage: SharePointStorage): Promise<void> {
    await this.ensureDataDirectory();
    await fs.writeFile(this.storageFile, JSON.stringify(storage, null, 2));
  }

  /**
   * Update SharePoint knowledge base with latest documents
   */
  public async updateKnowledgeBase(): Promise<{ updated: number; total: number }> {
    console.log('🔄 Updating SharePoint knowledge base...');
    
    try {
      // Get current storage
      const storage = await this.loadStorage();
      
      // Download and process all PDFs from SharePoint
      const results = await this.client.downloadAndProcessPdfs();
      
      // Clear previous documents and add new ones
      const newDocuments: SharePointDocument[] = results.map(result => ({
        fileName: result.fileName,
        text: result.text,
        lastUpdated: new Date(),
        size: result.text.length
      }));

      // Update storage
      const newStorage: SharePointStorage = {
        documents: newDocuments,
        lastSync: new Date()
      };

      await this.saveStorage(newStorage);

      console.log(`✅ SharePoint knowledge base updated: ${newDocuments.length} documents`);
      return {
        updated: newDocuments.length,
        total: newDocuments.length
      };

    } catch (error) {
      console.error('❌ Error updating SharePoint knowledge base:', error);
      throw error;
    }
  }

  /**
   * Search in SharePoint knowledge base
   */
  public async searchKnowledge(query: string, maxResults: number = 5): Promise<any[]> {
    const storage = await this.loadStorage();
    
    if (storage.documents.length === 0) {
      return [];
    }

    const queryLower = query.toLowerCase();
    const results: Array<{
      fileName: string;
      text: string;
      relevanceScore: number;
      excerpt: string;
    }> = [];

    // Simple text search with scoring
    for (const doc of storage.documents) {
      const textLower = doc.text.toLowerCase();
      
      // Calculate relevance score based on query term frequency
      const queryWords = queryLower.split(/\s+/);
      let score = 0;
      let matchPositions: number[] = [];

      for (const word of queryWords) {
        const matches = textLower.split(word).length - 1;
        score += matches;
        
        // Find positions for excerpt generation
        let pos = textLower.indexOf(word);
        while (pos !== -1) {
          matchPositions.push(pos);
          pos = textLower.indexOf(word, pos + 1);
        }
      }

      if (score > 0) {
        // Generate excerpt around first match
        let excerpt = '';
        if (matchPositions.length > 0) {
          const firstMatch = Math.min(...matchPositions);
          const start = Math.max(0, firstMatch - 100);
          const end = Math.min(doc.text.length, firstMatch + 300);
          excerpt = doc.text.substring(start, end);
          if (start > 0) excerpt = '...' + excerpt;
          if (end < doc.text.length) excerpt = excerpt + '...';
        } else {
          excerpt = doc.text.substring(0, 200) + '...';
        }

        results.push({
          fileName: doc.fileName,
          text: doc.text,
          relevanceScore: score,
          excerpt
        });
      }
    }

    // Sort by relevance score and return top results
    return results
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxResults);
  }

  /**
   * Get knowledge base status
   */
  public async getStatus(): Promise<{
    documentCount: number;
    lastSync: Date;
    totalSize: number;
  }> {
    const storage = await this.loadStorage();
    
    return {
      documentCount: storage.documents.length,
      lastSync: storage.lastSync,
      totalSize: storage.documents.reduce((sum, doc) => sum + doc.size, 0)
    };
  }

  /**
   * Get all document names
   */
  public async getDocumentNames(): Promise<string[]> {
    const storage = await this.loadStorage();
    return storage.documents.map(doc => doc.fileName);
  }
} 