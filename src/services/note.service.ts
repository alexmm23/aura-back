import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
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
      (notebook: any) => notebook.Pages?.flatMap((page: any) => page.Content || []) || [],
    )

    return contents
  } catch (error) {
    console.error('Error fetching notes:', error)
    throw error
  }
}

export async function getNoteById(noteId: number) {
  try {
    const note = await Content.findByPk(noteId)

    if (!note) {
      throw new Error('Note not found')
    }

    // Convert image to base64 if it's an image content
    if (note.type === 'image' && note.data) {
      try {
        // If data is already base64, return as is
        if (note.data.startsWith('data:image/')) {
          return note
        }
        // If data is a URL/path, read file and convert to base64
        const imagePath = path.join(
          process.cwd(),
          note.data.startsWith('/') ? note.data.slice(1) : note.data,
        )

        if (!fs.existsSync(imagePath)) {
          console.error('Image file not found:', imagePath)
          return note
        }

        const imageBuffer = fs.readFileSync(imagePath)
        const base64 = imageBuffer.toString('base64')

        // Determine the mime type based on file extension
        const ext = path.extname(imagePath).toLowerCase()
        const mimeType =
          ext === '.png'
            ? 'image/png'
            : ext === '.jpg' || ext === '.jpeg'
              ? 'image/jpeg'
              : 'image/png'

        return {
          ...note.toJSON(),
          data: `data:${mimeType};base64,${base64}`,
        }
      } catch (error) {
        console.error('Error converting image to base64:', error)
        return note
      }
    }

    return note
  } catch (error) {
    console.error('Error fetching note:', error)
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
    const initialContents = notebook.pages?.flatMap((page: any) => page.contents || []) || []

    // Convert image URLs to base64 for contents that have image data
    const contentsWithBase64 = await Promise.all(
      initialContents.map(async (content: any) => {
        if (content.type === 'image' && content.data) {
          try {
            console.log('Converting image to base64:', content.data)
            // If data is already base64, return as is
            if (content.data.startsWith('data:image/')) {
              return content
            }
            // If data is a URL/path, read file and convert to base64
            const imagePath = path.join(
              process.cwd(),
              content.data.startsWith('/') ? content.data.slice(1) : content.data,
            )

            if (!fs.existsSync(imagePath)) {
              console.error('Image file not found:', imagePath)
              return content
            }

            const imageBuffer = fs.readFileSync(imagePath)
            const base64 = imageBuffer.toString('base64')

            // Determine the mime type based on file extension
            const ext = path.extname(imagePath).toLowerCase()
            const mimeType =
              ext === '.png'
                ? 'image/png'
                : ext === '.jpg' || ext === '.jpeg'
                  ? 'image/jpeg'
                  : 'image/png'

            return {
              ...content.toJSON(),
              data: `data:${mimeType};base64,${base64}`,
            }
          } catch (error) {
            console.error('Error converting image to base64:', error)
            return content
          }
        }
        return content
      }),
    )
    console.log('Converted contents with base64 images:', contentsWithBase64)

    return contentsWithBase64
  } catch (error) {
    console.error('Error fetching notes:', error)
    throw error
  }
}
