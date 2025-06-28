import { Router } from 'express'
import multer from 'multer'
import sharp from 'sharp'
import { authenticateToken } from '@/middlewares/auth.middleware'

const upload = multer() // memory storage

const router = Router()

router.post(
  '/images/upload',
  authenticateToken,
  upload.single('image'),
  async (req, res) => {
    try {
      const file = req.file

      if (!file) {
        return res.status(400).json({ error: 'Missing image file' })
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