import sharp from 'sharp'
import Content from '@/models/content.model'
import Page from '@/models/pages.model' // Asegúrate de importar el modelo Page

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
  created_at: Date
  updated_at: Date
  stats: {
    originalSize: string
    compressedSize: string
    compressionRatio: string
    dimensions: string
  }
}

export async function saveCompressedPngImage({
  userId, // Corregido: era userId:number
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

    // Convertir a base64 para almacenar en BD
    const base64Data = compressedBuffer.toString('base64')

    // Save image in database
    const savedImage = await Content.create({
      page_id: pageId,
      type: 'image',
      data: base64Data,
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
