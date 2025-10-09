import { Router, Request, Response } from 'express'
import { ChatService } from '../services/chat.service.js'
import { authenticateToken } from '../middlewares/auth.middleware.js'
import { UserAttributes } from '../types/user.types.js'
import { CreateChatRequest, CreateMessageRequest } from '../types/chat.types.js'

const router = Router()

// ==================== CHAT ENDPOINTS ====================

/**
 * POST /api/chats - Crear o obtener chat entre usuarios
 */
router.post(
  '/',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' })
      }

      const { targetUserId }: CreateChatRequest = req.body

      if (!targetUserId) {
        res.status(400).json({
          error: 'targetUserId es requerido',
        })
      }

      const chat = await ChatService.createOrGetChat({ userId, targetUserId })

      res.status(201).json({
        success: true,
        data: { chat },
        message: 'Chat creado o recuperado exitosamente',
      })
    } catch (error: any) {
      console.error('Error creating chat:', error)
      res.status(500).json({
        error: 'Error al crear el chat',
        details: error.message,
      })
    }
  },
)

/**
 * GET /api/chats - Obtener todos los chats del usuario
 */
router.get(
  '/',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' })
        return
      }

      const chats = await ChatService.getUserChats(userId)

      res.json({
        success: true,
        data: {
          chats,
          total: chats.length,
        },
      })
    } catch (error: any) {
      console.error('Error getting chats:', error)
      res.status(500).json({
        error: 'Error al obtener los chats',
        details: error.message,
      })
    }
  },
)

/**
 * GET /api/chats/:chatId - Obtener chat específico con mensajes
 */
router.get(
  '/:chatId',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const userId = req.user?.id
      const { chatId } = req.params

      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' })
        return
      }

      if (!chatId || isNaN(Number(chatId))) {
        res.status(400).json({ error: 'ID de chat inválido' })
        return
      }

      const chat = await ChatService.getChatById(Number(chatId), userId)

      if (!chat) {
        res.status(404).json({ error: 'Chat no encontrado' })
        return
      }

      res.json({
        success: true,
        data: { chat },
      })
    } catch (error: any) {
      console.error('Error getting chat:', error)
      if (error.message.includes('permiso')) {
        res.status(403).json({ error: error.message })
        return
      }
      res.status(500).json({
        error: 'Error al obtener el chat',
        details: error.message,
      })
    }
  },
)

/**
 * GET /api/chats/:chatId/messages - Obtener mensajes de un chat con paginación
 */
router.get(
  '/:chatId/messages',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const userId = req.user?.id
      const { chatId } = req.params
      const { page = '1', limit = '50' } = req.query

      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' })
        return
      }

      if (!chatId || isNaN(Number(chatId))) {
        res.status(400).json({ error: 'ID de chat inválido' })
        return
      }

      const pageNum = Math.max(1, parseInt(page as string) || 1)
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50))

      const result = await ChatService.getChatMessages(Number(chatId), userId, pageNum, limitNum)

      res.json({
        success: true,
        data: result,
      })
    } catch (error: any) {
      console.error('Error getting chat messages:', error)
      if (error.message.includes('permiso')) {
        res.status(403).json({ error: error.message })
        return
      }
      res.status(500).json({
        error: 'Error al obtener los mensajes',
        details: error.message,
      })
      return
    }
  },
)

/**
 * POST /api/chats/:chatId/messages - Enviar mensaje
 */
router.post(
  '/:chatId/messages',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const userId = req.user?.id
      const { chatId } = req.params
      const { content }: CreateMessageRequest = req.body

      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' })
        return
      }

      if (!chatId || isNaN(Number(chatId))) {
        res.status(400).json({ error: 'ID de chat inválido' })
        return
      }

      if (!content || content.trim().length === 0) {
        res.status(400).json({ error: 'El contenido del mensaje es requerido' })
        return
      }

      if (content.length > 5000) {
        res.status(400).json({
          error: 'El mensaje no puede exceder 5000 caracteres',
        })
        return
      }

      const message = await ChatService.createMessage({
        content: content.trim(),
        chat_id: Number(chatId),
        sender_id: userId,
      })

      res.status(201).json({
        success: true,
        data: { message },
        message: 'Mensaje enviado exitosamente',
      })
    } catch (error: any) {
      console.error('Error sending message:', error)
      if (error.message.includes('permiso')) {
        res.status(403).json({ error: error.message })
        return
      }
      res.status(500).json({
        error: 'Error al enviar el mensaje',
        details: error.message,
      })
    }
  },
)

/**
 * PATCH /api/chats/:chatId/mark-read - Marcar mensajes como leídos
 */
router.patch(
  '/:chatId/mark-read',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const userId = req.user?.id
      const { chatId } = req.params

      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' })
        return
      }

      if (!chatId || isNaN(Number(chatId))) {
        res.status(400).json({ error: 'ID de chat inválido' })
        return
      }

      const updatedCount = await ChatService.markMessagesAsRead(Number(chatId), userId)

      res.json({
        success: true,
        data: { updatedCount },
        message: `${updatedCount} mensajes marcados como leídos`,
      })
    } catch (error: any) {
      console.error('Error marking messages as read:', error)
      if (error.message.includes('permiso')) {
        res.status(403).json({ error: error.message })
        return
      }
      res.status(500).json({
        error: 'Error al marcar mensajes como leídos',
        details: error.message,
      })
    }
  },
)

/**
 * GET /api/chats/stats - Obtener estadísticas de chat del usuario
 */
router.get(
  '/stats/summary',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' })
        return
      }

      const stats = await ChatService.getChatStats(userId)

      res.json({
        success: true,
        data: { stats },
      })
    } catch (error: any) {
      console.error('Error getting chat stats:', error)
      res.status(500).json({
        error: 'Error al obtener estadísticas de chat',
        details: error.message,
      })
    }
  },
)

export { router as chatRouter }
