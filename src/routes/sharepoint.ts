import { Router, Request, Response } from 'express';
import { SharePointKnowledgeBase } from '../sharepoint-storage';

const router = Router();
const sharepointKB = new SharePointKnowledgeBase();

/**
 * Update SharePoint knowledge base
 */
router.post('/update', async (req: Request, res: Response) => {
  try {
    console.log('📥 SharePoint update request received');
    
    const result = await sharepointKB.updateKnowledgeBase();
    
    res.json({
      success: true,
      message: 'SharePoint knowledge base updated successfully',
      ...result
    });
  } catch (error) {
    console.error('❌ Error updating SharePoint KB:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating SharePoint knowledge base',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Get SharePoint knowledge base status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await sharepointKB.getStatus();
    
    res.json({
      success: true,
      status: {
        documentCount: status.documentCount,
        lastSync: status.lastSync,
        totalSize: status.totalSize,
        formattedSize: formatBytes(status.totalSize)
      }
    });
  } catch (error) {
    console.error('❌ Error getting SharePoint KB status:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting SharePoint knowledge base status',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Get list of documents in SharePoint knowledge base
 */
router.get('/documents', async (req: Request, res: Response) => {
  try {
    const documents = await sharepointKB.getDocumentNames();
    
    res.json({
      success: true,
      documents
    });
  } catch (error) {
    console.error('❌ Error getting SharePoint documents:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting SharePoint documents',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Search in SharePoint knowledge base (for testing)
 */
router.post('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const { query, maxResults = 5 } = req.body;
    
    if (!query || typeof query !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Query parameter is required and must be a string'
      });
      return;
    }
    
    const results = await sharepointKB.searchKnowledge(query, maxResults);
    
    res.json({
      success: true,
      query,
      results: results.map(result => ({
        fileName: result.fileName,
        excerpt: result.excerpt,
        relevanceScore: result.relevanceScore
      }))
    });
  } catch (error) {
    console.error('❌ Error searching SharePoint KB:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching SharePoint knowledge base',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Utility function to format bytes
 */
function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default router; 