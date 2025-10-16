import { Router, Request, Response } from 'express'
import { authenticateToken } from '../middlewares/auth.middleware.js'
import { UserAttributes } from '../types/user.types.js'
import {
  processImageOCR,
  processImageStudy,
  checkAuraAIHealth,
} from '../services/auraAi.service.js'
import Content from '../models/content.model.js'
import Page from '../models/pages.model.js'
import path from 'path'
import fs from 'fs'

const router = Router()

/**
 * POST /api/auraai/ocr - Procesa imágenes con OCR
 * Body: { content_ids: [1, 2, 3] } o { page_ids: [1, 2] }
 */
router.post(
  '/ocr',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id
      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' })
        return
      }

      const { content_ids, page_ids } = req.body

      if (!content_ids && !page_ids) {
        res.status(400).json({
          error: 'Debe proporcionar content_ids o page_ids',
        })
        return
      }

      const results = []

      // Procesar imágenes de Content
      if (content_ids && Array.isArray(content_ids)) {
        for (const contentId of content_ids) {
          try {
            const content: typeof Content = await Content.findByPk(contentId)
            if (!content) {
              results.push({
                content_id: contentId,
                error: 'Contenido no encontrado',
                success: false,
              })
              continue
            }

            const imagePath = path.join(process.cwd(), 'storage', 'images', content.data)

            if (!fs.existsSync(imagePath)) {
              results.push({
                content_id: contentId,
                error: 'Imagen no encontrada en el servidor',
                success: false,
              })
              continue
            }

            const ocrResult = await processImageOCR(imagePath)
            console.log(
              `OCR resultado para content_id ${contentId}:`, ocrResult
            )

            results.push({
              content_id: contentId,
              image_url: content.data,
              success: true,
              ...ocrResult,
            })
          } catch (error: any) {
            results.push({
              content_id: contentId,
              error: error.message,
              success: false,
            })
          }
        }
      }

      // Procesar imágenes de Page
      if (page_ids && Array.isArray(page_ids)) {
        for (const pageId of page_ids) {
          try {
            const page: any = await Page.findByPk(pageId)

            if (!page) {
              results.push({
                page_id: pageId,
                error: 'Página no encontrada',
                success: false,
              })
              continue
            }

            const imagePath = path.join(process.cwd(), 'storage', 'images', page.image)

            if (!fs.existsSync(imagePath)) {
              results.push({
                page_id: pageId,
                error: 'Imagen no encontrada en el servidor',
                success: false,
              })
              continue
            }

            const ocrResult = await processImageOCR(imagePath)
            console.log(`OCR resultado para page_id ${pageId}:`, ocrResult)

            results.push({
              page_id: pageId,
              image_url: page.image,
              success: true,
              ...ocrResult,
            })
          } catch (error: any) {
            results.push({
              page_id: pageId,
              error: error.message,
              success: false,
            })
          }
        }
      }

      res.json({
        success: true,
        data: {
          results,
          total: results.length,
          successful: results.filter((r: any) => r.success).length,
          failed: results.filter((r: any) => !r.success).length,
        },
      })
    } catch (error: any) {
      console.error('Error en OCR:', error)
      res.status(500).json({
        error: 'Error al procesar las imágenes',
        details: error.message,
      })
    }
  },
)

/**
 * POST /api/auraai/study - Procesa imágenes y genera material de estudio
 * Body: { content_ids: [1, 2], num_questions: 5 } o { page_ids: [1], num_questions: 10 }
 */
router.post(
  '/study',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id
      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' })
        return
      }

      const { content_ids, page_ids, num_questions = 5 } = req.body

      if (!content_ids && !page_ids) {
        res.status(400).json({
          error: 'Debe proporcionar content_ids o page_ids',
        })
        return
      }

      const results = []

      // Procesar imágenes de Content
      if (content_ids && Array.isArray(content_ids)) {
        for (const contentId of content_ids) {
          try {
            const content: typeof Content = await Content.findByPk(contentId)

            if (!content) {
              results.push({
                content_id: contentId,
                error: 'Contenido no encontrado',
                success: false,
              })
              continue
            }

            const imagePath = path.join(process.cwd(), 'storage', 'images', content.data)

            if (!fs.existsSync(imagePath)) {
              results.push({
                content_id: contentId,
                error: 'Imagen no encontrada en el servidor',
                success: false,
              })
              continue
            }

            const studyResult = await processImageStudy(imagePath, num_questions)

            results.push({
              content_id: contentId,
              image_url: content.image_url,
              success: true,
              ...studyResult,
            })
          } catch (error: any) {
            results.push({
              content_id: contentId,
              error: error.message,
              success: false,
            })
          }
        }
      }

      // Procesar imágenes de Page
      if (page_ids && Array.isArray(page_ids)) {
        for (const pageId of page_ids) {
          try {
            const page: any = await Page.findByPk(pageId)

            if (!page) {
              results.push({
                page_id: pageId,
                error: 'Página no encontrada',
                success: false,
              })
              continue
            }

            const imagePath = path.join(process.cwd(), 'storage', 'images', page.image)

            if (!fs.existsSync(imagePath)) {
              results.push({
                page_id: pageId,
                error: 'Imagen no encontrada en el servidor',
                success: false,
              })
              continue
            }

            const studyResult = await processImageStudy(imagePath, num_questions)

            results.push({
              page_id: pageId,
              image_url: page.image,
              success: true,
              ...studyResult,
            })
          } catch (error: any) {
            results.push({
              page_id: pageId,
              error: error.message,
              success: false,
            })
          }
        }
      }

      res.json({
        success: true,
        data: {
          results,
          total: results.length,
          successful: results.filter((r: any) => r.success).length,
          failed: results.filter((r: any) => !r.success).length,
        },
      })
    } catch (error: any) {
      console.error('Error en estudio:', error)
      res.status(500).json({
        error: 'Error al generar material de estudio',
        details: error.message,
      })
    }
  },
)

/**
 * GET /api/auraai/health - Verifica el estado de la API de Python
 */
router.get('/health', async (req: Request, res: Response): Promise<void> => {
  try {
    const health = await checkAuraAIHealth()
    res.json({
      success: true,
      data: health,
    })
  } catch (error: any) {
    console.error('Error verificando salud de AuraAI:', error)
    res.status(503).json({
      success: false,
      error: 'API de AuraAI no disponible',
      details: error.message,
    })
  }
})

export { router as auraAiRouter }
