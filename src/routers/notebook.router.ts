import { Router, Request, Response } from 'express'
import { authenticateToken } from '@/middlewares/auth.middleware'
import { NotebookService } from '@/services/notebook.service'
import { UserAttributes } from '@/types/user.types'

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
    const existingNotebook = await notebookService.searchByName(title)
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

export { notebookRouter }
