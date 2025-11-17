import { Router, Request, Response } from 'express'
import { authenticateToken } from '@/middlewares/auth.middleware'
import { NotebookService } from '@/services/notebook.service'
import { UserAttributes } from '@/types/user.types'
import env from '@/config/enviroment'

// Extender el tipo Request para incluir la propiedad user
declare module 'express-serve-static-core' {
  interface Request {
    user?: UserAttributes
  }
}

const notebookRouter = Router()
const notebookService = new NotebookService()

console.log('📚 Notebook router loaded')

notebookRouter.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'Notebook service is healthy' })
})

notebookRouter.post('/add', authenticateToken, async (req: Request, res: Response) => {
  // console.log('Creating notebook with request body:', req.body)
  // res.json({ message: 'Creating notebook' })
  // return;
  try {
    const { title } = req.body
    const userId = req.user?.id // Obtener userId del token
    console.log('User ID from token:', userId)

    if (!userId) {
      res.status(400).json({ error: 'User ID not found in token' })
      return
    }
    const existingNotebook = await notebookService.searchByName(title, Number(userId))
    if (existingNotebook) {
      res.status(409).json({ error: 'Notebook with this title already exists' })
      return
    }
    const notebook = await notebookService.createNotebook(userId, title)
    res.status(201).json(notebook)
  } catch (error) {
    console.error('Error creating notebook:', error)
    res.status(500).json({ error: `Internal Server Error: ${error}` })
  }
})
notebookRouter.get('/list', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id // Obtener userId del token

    if (!userId) {
      res.status(400).json({ error: 'User ID not found in token' })
      return
    }

    const notebooks = await notebookService.getNotebooks(Number(userId))
    res.status(200).json(notebooks)
  } catch (error) {
    res.status(500).json({ error: `Internal Server Error: ${error}` })
  }
})
notebookRouter.delete('/delete/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const notebookId = Number(req.params.id)
    if (!notebookId) {
      res.status(400).json({ error: 'Notebook ID is required' })
      return
    }
    await notebookService.deleteNotebook(notebookId)
    res.status(204).send()
  } catch (error) {
    res.status(500).json({ error: `Internal Server Error: ${error}` })
  }
})
//Editar titulo de un notebook
notebookRouter.put('/edit/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const notebookId = Number(req.params.id)
    const { title } = req.body
    if (!notebookId || !title) {
      res.status(400).json({ error: 'Notebook ID and title are required' })
      return
    }
    const updatedNotebook = await notebookService.updateNotebook(notebookId, title)
    res.status(200).json({ message: 'Notebook updated successfully' })
  } catch (error) {
    res.status(500).json({ error: `Internal Server Error: ${error}` })
  }
})

// GET /api/notebook/:id/pages - Obtener páginas de un notebook específico
notebookRouter.get('/:id/pages', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    const notebookId = Number(req.params.id)

    if (!userId) {
      res.status(400).json({ error: 'User ID not found in token' })
      return
    }

    if (!notebookId) {
      res.status(400).json({ error: 'Notebook ID is required' })
      return
    }

    // Determinar la URL base según el entorno
    const baseUrl =
      env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://back.aurapp.com.mx'

    // Obtener páginas del notebook específico
    const pagesData = await notebookService.getNotebookPages(notebookId, Number(userId))

    const pages = pagesData.map((page: any) => {
      return {
        id: page.id,
        title: page.title,
        createdAt: page.created_at,
        contents: page.contents.map((content: any) => {
          // Si el content.data es una ruta de imagen, agregar el baseUrl
          let dataWithUrl = content.data
          if (content.type === 'image' && content.data && !content.data.startsWith('http')) {
            dataWithUrl = `${baseUrl}${content.data.startsWith('/') ? '' : '/'}${content.data}`
          }

          return {
            id: content.id,
            type: content.type,
            data: dataWithUrl,
            x: content.x,
            y: content.y,
            width: content.width,
            height: content.height,
            createdAt: content.created_at,
          }
        }),
      }
    })

    res.status(200).json({
      success: true,
      data: {
        pages,
        total: pages.length,
      },
    })
  } catch (error) {
    console.error('Error getting notebook pages:', error)
    res.status(500).json({ error: `Internal Server Error: ${error}` })
  }
})

// GET /api/notebook/pages - Obtener todas las páginas del usuario
notebookRouter.get('/pages', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      res.status(400).json({ error: 'User ID not found in token' })
      return
    }

    // Determinar la URL base según el entorno
    const baseUrl =
      env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://back.aurapp.com.mx'

    // Obtener todas las páginas del usuario a través de sus notebooks
    const pagesData = await notebookService.getAllUserPages(Number(userId))

    const pages = pagesData.map((page: any) => {
      return {
        id: page.id,
        title: page.title,
        createdAt: page.created_at,
        contents: page.contents.map((content: any) => {
          // Si el content.data es una ruta de imagen, agregar el baseUrl
          let dataWithUrl = content.data
          if (content.type === 'image' && content.data && !content.data.startsWith('http')) {
            dataWithUrl = `${baseUrl}${content.data.startsWith('/') ? '' : '/'}${content.data}`
          }

          return {
            id: content.id,
            type: content.type,
            data: dataWithUrl,
            x: content.x,
            y: content.y,
            width: content.width,
            height: content.height,
            createdAt: content.created_at,
          }
        }),
      }
    })

    res.status(200).json({
      success: true,
      data: {
        pages,
        total: pages.length,
      },
    })
  } catch (error) {
    console.error('Error getting user pages:', error)
    res.status(500).json({ error: `Internal Server Error: ${error}` })
  }
})

export { notebookRouter }
