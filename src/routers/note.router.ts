import { Router } from 'express'
import multer from 'multer'
import sharp from 'sharp'
import { authenticateToken } from '@/middlewares/auth.middleware'
import { saveCompressedPngImage} from '@/services/sendnote.service'


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
        data: result
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
        res.status(400).json({ error: 'Missing image file' })
        return 
      }

      // Compress PNG using sharp
      const compressedBuffer = await sharp(file.buffer)
        .png({ quality: 70, compressionLevel: 9 })
        .toBuffer()

      // Return the compressed image as base64 (or you can send as a file/buffer)
      res.status(201).json({
        compressedImage: compressedBuffer.toString('base64'),
        message: 'Image compressed successfully',
      })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }
)
export { router as noteRouter }