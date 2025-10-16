import { Router } from 'express'
import multer from 'multer'
import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'
import { authenticateToken } from '@/middlewares/auth.middleware'
import { saveCompressedPngImage } from '@/services/sendnote.service'
import { getNotesByNotebookId, getNotesByUserId, getNoteById } from '@/services/note.service'
import Page from '@/models/pages.model'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB límite
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      const error = new Error('Solo se permiten archivos de imagen') as any
      cb(error)
    }
  },
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
        error: 'Invalid filename',
      })
      return
    }

    const imagePath = path.join(__dirname, '../../storage/images', filename)
    console.log('Serving image from path:', imagePath)
    // Enviar archivo con headers apropiados
    res.sendFile(imagePath, (err) => {
      if (err) {
        console.error('Error serving image:', err)
        res.status(404).json({
          success: false,
          error: 'Image not found',
        })
      }
    })
  } catch (error) {
    console.error('Error in image route:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
})
router.get('/list', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
      })
      return
    }

    // Lógica para obtener la lista de notas del usuario
    const notes = await getNotesByUserId(userId)

    res.status(200).json({
      success: true,
      data: notes,
    })
  } catch (error: any) {
    console.error('Error fetching notes:', error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})
//Obtener notas de usuario por cuaderno
router.get('/list/:notebookId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id
    const notebookId = Number(req.params.notebookId)

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
      })
      return
    }

    // Lógica para obtener la lista de notas del usuario en el cuaderno específico
    const notes = await getNotesByNotebookId(notebookId)
    // console.log('Notas en el cuaderno:', notes)

    res.status(200).json({
      success: true,
      data: notes,
    })
  } catch (error: any) {
    console.error('Error fetching notes:', error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

router.get('/show/:id', authenticateToken, async (req, res) => {
  try {
    const noteId = Number(req.params.id)

    if (!noteId) {
      res.status(400).json({
        success: false,
        error: 'Invalid note ID',
      })
      return
    }

    const note = await getNoteById(noteId)

    if (!note) {
      res.status(404).json({
        success: false,
        error: 'Note not found',
      })
      return
    }

    res.status(200).json({
      success: true,
      data: note,
    })
  } catch (error: any) {
    console.error('Error fetching note:', error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

router.post('/images/upload', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const fileBase64: string = req.body.image
    if (!fileBase64) {
      res.status(400).json({
        success: false,
        error: 'Missing image file',
      })
      return
    }

    //Convertir base64 a buffer
    const fileBuffer = Buffer.from(fileBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64')
    const file = {
      originalname: 'uploaded_image.png', // Nombre de archivo por defecto
      buffer: fileBuffer,
      mimetype: 'image/png', // Asumir PNG, ajustar según sea necesario
    }

    // Obtener datos del body
    const { notebook_id, x, y } = req.body
    const userId = req.user?.id // Desde el middleware de autenticación

    // Validar usuario autenticado
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
      })
      return
    }

    // Validar page_id
    if (!notebook_id) {
      res.status(400).json({
        success: false,
        error: 'notebook_id is required',
      })
      return
    }
    const newPage = await Page.create({
      notebook_id: notebook_id,
      title: 'New Page',
    })
    const page_id = newPage.id

    // Usar el service para guardar la imagen
    const result = await saveCompressedPngImage({
      userId,
      pageId: parseInt(page_id),
      imageBuffer: file.buffer,
      x: x ? parseFloat(x) : 0,
      y: y ? parseFloat(y) : 0,
    })

    const url = `/api/notes/images/${path.basename(result.image_path)}`

    res.status(201).json({
      success: true,
      message: 'Image compressed and saved successfully',
      data: {
        ...result,
        // Proporcionar URL completa para acceder a la imagen
        image_url: url,
      },
    })
  } catch (error: any) {
    console.error('Error uploading image:', error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

router.post('/images/compress', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const file = req.file

    if (!file) {
      res.status(400).json({
        success: false,
        error: 'Missing image file',
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
    const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100

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
          finalDimensions: `${finalMetadata.width}x${finalMetadata.height}`,
        },
      },
    })
  } catch (error: any) {
    console.error('Error compressing image:', error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

export { router as noteRouter }
