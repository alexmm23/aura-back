import sharp from 'sharp'
import { Content, Notebook, Page, User } from '@/models/index'

export async function saveCompressedPngImage(
  userId: number,
  notebookId: number,
  imageBuffer: Buffer,
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

export async function getNotesByUserId(userId: number) {
  try {
    const user = await User.findByPk(userId)

    if (!user) {
      throw new Error('User not found')
    }
    const notebooks = await Notebook.findAll({
      where: {
        user_id: userId,
      },
      include: [
        {
          model: Page,
          as: 'pages', // Usar el alias definido en la asociación
          include: [
            {
              model: Content,
              as: 'contents', // Usar el alias definido en la asociación
            },
          ],
        },
      ],
    })

    if (!notebooks.length) {
      throw new Error('No notebooks found')
    }

    // Extract all contents from all pages in all notebooks
    const contents = notebooks.flatMap(
      (notebook: any) => notebook.Pages?.flatMap((page: any) => page.Contents || []) || [],
    )

    return contents
  } catch (error) {
    console.error('Error fetching notes:', error)
    throw error
  }
}
export async function getNotesByNotebookId(notebookId: number) {
  try {
    const notebook = await Notebook.findByPk(notebookId, {
      include: [
        {
          model: Page,
          as: 'pages',
          include: [
            {
              model: Content,
              as: 'contents',
            },
          ],
        },
      ],
    })

    if (!notebook) {
      throw new Error('Notebook not found')
    }

    // Extract all contents from all pages in the notebook
    const contents = notebook.Pages?.flatMap((page: any) => page.Contents || []) || []

    return contents
  } catch (error) {
    console.error('Error fetching notes:', error)
    throw error
  }
}
