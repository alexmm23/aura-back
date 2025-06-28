import sharp from 'sharp'
import Content from '@/models/content.model'

export async function saveCompressedPngImage(
  userId: number,
  notebookId: number,
  imageBuffer: Buffer
) {
  // Compress PNG using sharp
  const compressedBuffer = await sharp(imageBuffer)
    .png({ quality: 70, compressionLevel: 9 })
    .toBuffer()

  // Save image (as a note or just as an image)
  const image = await Content.create({
    page_id: notebookId,
    type: 'image',
    data: compressedBuffer.toString('base64'), // Or save as a file if preferred
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  })

  return image
}