import { Router } from 'express'
import multer from 'multer'
import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'
import { authenticateToken } from '@/middlewares/auth.middleware'
import { saveCompressedPngImage } from '@/services/sendnote.service'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB límite
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      const error = new Error('Solo se permiten archivos de imagen') as any
      cb(error)
    }
  }
})

const router = Router()

// Ruta para servir imágenes estáticas
router.get('/images/:filename', (req, res) => {
  try {
    const { filename } = req.params
    
    // Validar que el filename sea seguro (sin path traversal)
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      res.status(400).json({
        success: false,
        error: 'Invalid filename'
      })
      return
    }
    
    const imagePath = path.join(__dirname, '../../storage/images', filename)
    
    // Enviar archivo con headers apropiados
    res.sendFile(imagePath, (err) => {
      if (err) {
        console.error('Error serving image:', err)
        res.status(404).json({
          success: false,
          error: 'Image not found'
        })
      }
    })
  } catch (error) {
    console.error('Error in image route:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

router.post(
  '/images/upload',
  authenticateToken,
  upload.single('image'),
  async (req, res) => {
    try {
      const file = req.file

      if (!file) {
        res.status(400).json({ 
          success: false,
          error: 'Missing image file' 
        })
        return 
      }

      // Obtener datos del body
      const { page_id, x, y } = req.body
      const userId = req.user?.id // Desde el middleware de autenticación

      // Validar usuario autenticado
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated'
        })
        return
      }

      // Validar page_id
      if (!page_id) {
        res.status(400).json({
          success: false,
          error: 'page_id is required'
        })
        return
      }

      // Usar el service para guardar la imagen
      const result = await saveCompressedPngImage({
        userId,
        pageId: parseInt(page_id),
        imageBuffer: file.buffer,
        x: x ? parseFloat(x) : 0,
        y: y ? parseFloat(y) : 0
      })

      res.status(201).json({
        success: true,
        message: 'Image compressed and saved successfully',
        data: {
          ...result,
          // Proporcionar URL completa para acceder a la imagen
          image_url: `/api/notes/images/${path.basename(result.image_path)}`
        }
      })

    } catch (error: any) {
      console.error('Error uploading image:', error)
      res.status(500).json({ 
        success: false,
        error: error.message 
      })
    }
  }
)

router.post(
  '/images/compress',
  authenticateToken,
  upload.single('image'),
  async (req, res) => {
    try {
      const file = req.file

      if (!file) {
        res.status(400).json({ 
          success: false,
          error: 'Missing image file' 
        })
        return 
      }

      // Obtener metadatos originales
      const originalMetadata = await sharp(file.buffer).metadata()

      // Compress PNG using sharp
      const compressedBuffer = await sharp(file.buffer)
        .png({ quality: 70, compressionLevel: 9 })
        .toBuffer()

      // Obtener metadatos finales
      const finalMetadata = await sharp(compressedBuffer).metadata()

      // Calcular estadísticas
      const originalSize = file.buffer.length
      const compressedSize = compressedBuffer.length
      const compressionRatio = ((originalSize - compressedSize) / originalSize * 100)

      // Return the compressed image as base64 junto con estadísticas
      res.status(200).json({
        success: true,
        message: 'Image compressed successfully',
        data: {
          compressedImage: compressedBuffer.toString('base64'),
          stats: {
            originalSize: `${(originalSize / 1024).toFixed(2)} KB`,
            compressedSize: `${(compressedSize / 1024).toFixed(2)} KB`,
            compressionRatio: `${compressionRatio.toFixed(2)}%`,
            originalDimensions: `${originalMetadata.width}x${originalMetadata.height}`,
            finalDimensions: `${finalMetadata.width}x${finalMetadata.height}`
          }
        }
      })
    } catch (error: any) {
      console.error('Error compressing image:', error)
      res.status(500).json({ 
        success: false,
        error: error.message 
      })
    }
  }
)

export { router as noteRouter }