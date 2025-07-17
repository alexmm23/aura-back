import sharp from 'sharp'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import Content from '@/models/content.model'
import Page from '@/models/pages.model'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface SaveImageParams {
  userId: number
  pageId: number
  imageBuffer: Buffer
  x?: number
  y?: number
}

interface SaveImageResult {
  id: number
  page_id: number
  type: string
  x: number
  y: number
  width: number
  height: number
  image_path: string
  created_at: Date
  updated_at: Date
  stats: {
    originalSize: string
    compressedSize: string
    compressionRatio: string
    dimensions: string
  }
}

// Función para asegurar que el directorio existe
async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath)
  } catch {
    await fs.mkdir(dirPath, { recursive: true })
  }
}

// Función para generar nombre único de archivo
function generateFileName(userId: number, pageId: number): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  return `img_${userId}_${pageId}_${timestamp}_${random}.png`
}

export async function saveCompressedPngImage({
  userId,
  pageId,
  imageBuffer,
  x = 0,
  y = 0
}: SaveImageParams): Promise<SaveImageResult> {
  try {
    // Obtener metadatos originales
    const originalMetadata = await sharp(imageBuffer).metadata()
    
    // Compress PNG using sharp
    const compressedBuffer = await sharp(imageBuffer)
      .png({ quality: 70, compressionLevel: 9 })
      .toBuffer()

    // Obtener metadatos finales
    const finalMetadata = await sharp(compressedBuffer).metadata()

    // Definir rutas
    const storageDir = path.join(__dirname, '../../storage/images')
    const fileName = generateFileName(userId, pageId)
    const filePath = path.join(storageDir, fileName)
    
    // Crear directorio si no existe
    await ensureDirectoryExists(storageDir)
    
    // Guardar imagen en el sistema de archivos
    await fs.writeFile(filePath, compressedBuffer)
    
    // Ruta relativa para guardar en BD (desde src/)
    const relativePath = `storage/images/${fileName}`

    // Save image metadata in database
    const savedImage = await Content.create({
      page_id: pageId,
      type: 'image',
      data: relativePath, // Guardamos la ruta en lugar del base64
      x: x,
      y: y,
      width: finalMetadata.width || 0,
      height: finalMetadata.height || 0,
    })

    // Calcular estadísticas
    const originalSize = imageBuffer.length
    const compressedSize = compressedBuffer.length
    const compressionRatio = ((originalSize - compressedSize) / originalSize * 100)

    return {
      id: savedImage.id,
      page_id: savedImage.page_id,
      type: savedImage.type,
      x: savedImage.x,
      y: savedImage.y,
      width: savedImage.width,
      height: savedImage.height,
      image_path: relativePath,
      created_at: savedImage.created_at,
      updated_at: savedImage.updated_at,
      stats: {
        originalSize: `${(originalSize / 1024).toFixed(2)} KB`,
        compressedSize: `${(compressedSize / 1024).toFixed(2)} KB`,
        compressionRatio: `${compressionRatio.toFixed(2)}%`,
        dimensions: `${finalMetadata.width}x${finalMetadata.height}`
      }
    }
  }
  catch (error) {
    throw new Error(`Error saving compressed image: ${(error as Error).message}`)
  }
}

// Función auxiliar para eliminar imagen del sistema de archivos
export async function deleteImageFile(imagePath: string): Promise<void> {
  try {
    const fullPath = path.join(__dirname, '../../', imagePath)
    await fs.unlink(fullPath)
  } catch (error) {
    console.error('Error deleting image file:', error)
    // No lanzamos error para que no falle la operación principal
  }
}