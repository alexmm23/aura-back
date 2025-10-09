import { UserAttributes } from '@/types/user.types.js'
import { Chat, Message, User } from '../models/index.js'
import {
  ChatAttributes,
  CreateChatRequest,
  MessageAttributes,
  CreateMessageRequest,
  ChatWithDetails,
  MessageWithSender,
} from '../types/chat.types.js'
import { Op } from 'sequelize'

export class ChatService {
  // ==================== CHAT METHODS ====================

  /**
   * Crear o obtener chat existente entre estudiante y maestro
   */
  static async createOrGetChat(data: CreateChatRequest): Promise<ChatAttributes> {
    try {
      //Verificar si el usuario es estudiante o maestro
      const userId = data.userId
      const targetUserId = data.targetUserId
      if (!userId || !targetUserId) {
        throw new Error('userId y targetUserId son requeridos')
      }
      const userRole = await User.findByPk(userId).then((user: UserAttributes | null) => {
        if (user?.role_id === 1) {
          //El usuario es administrador
          throw new Error('Los administradores no pueden iniciar chats')
        }
        return user?.role_id
      })
      const student_id = userRole === 2 ? userId : targetUserId
      const teacher_id = userRole === 3 ? userId : targetUserId
      if (student_id === teacher_id) {
        throw new Error('No puedes iniciar un chat contigo mismo')
      }
      const existingChat = await Chat.findOne({
        where: {
          student_id: student_id,
          teacher_id: teacher_id,
        },
      })

      if (existingChat) {
        return existingChat.dataValues
      }

      // Crear nuevo chat
      const newChat = await Chat.create({
        student_id: student_id,
        teacher_id: teacher_id,
      })

      return newChat.dataValues
    } catch (error) {
      console.error('Error creating/getting chat:', error)
      throw new Error('Error al crear o obtener el chat')
    }
  }

  /**
   * Obtener todos los chats de un usuario (como estudiante o maestro)
   */
  static async getUserChats(userId: number): Promise<ChatWithDetails[]> {
    try {
      const chats = await Chat.findAll({
        where: {
          [Op.or]: [{ student_id: userId }, { teacher_id: userId }],
        },
        include: [
          {
            model: User,
            as: 'student',
            attributes: ['id', 'email', 'name', 'lastname'],
          },
          {
            model: User,
            as: 'teacher',
            attributes: ['id', 'email', 'name', 'lastname'],
          },
          {
            model: Message,
            as: 'messages',
            limit: 1,
            order: [['created_at', 'DESC']],
            include: [
              {
                model: User,
                as: 'sender',
                attributes: ['id', 'email', 'name', 'lastname'],
              },
            ],
          },
        ],
        order: [['updated_at', 'DESC']],
      })

      // Calcular mensajes no leídos para cada chat
      const chatsWithDetails = await Promise.all(
        chats.map(async (chat: any) => {
          const unreadCount = await Message.count({
            where: {
              chat_id: chat.dataValues.id,
              sender_id: { [Op.ne]: userId }, // No contar mensajes propios
              is_read: false,
            },
          })

          const chatData = chat.dataValues
          return {
            ...chatData,
            unread_count: unreadCount,
            last_message: chatData.messages?.[0] || null,
          }
        }),
      )

      return chatsWithDetails
    } catch (error) {
      console.error('Error getting user chats:', error)
      throw new Error('Error al obtener los chats del usuario')
    }
  }

  /**
   * Obtener un chat específico con sus mensajes
   */
  static async getChatById(chatId: number, userId: number): Promise<ChatWithDetails | null> {
    try {
      const chat = await Chat.findByPk(chatId, {
        include: [
          {
            model: User,
            as: 'student',
            attributes: ['id', 'email', 'name', 'lastname'],
          },
          {
            model: User,
            as: 'teacher',
            attributes: ['id', 'email', 'name', 'lastname'],
          },
          {
            model: Message,
            as: 'messages',
            include: [
              {
                model: User,
                as: 'sender',
                attributes: ['id', 'email', 'name', 'lastname'],
              },
            ],
            order: [['created_at', 'ASC']],
          },
        ],
      })

      if (!chat) {
        return null
      }

      const chatData = chat.dataValues

      // Verificar que el usuario pertenece a este chat
      if (chatData.student_id !== userId && chatData.teacher_id !== userId) {
        throw new Error('No tienes permiso para acceder a este chat')
      }

      return chatData
    } catch (error) {
      console.error('Error getting chat by ID:', error)
      throw error
    }
  }

  // ==================== MESSAGE METHODS ====================

  /**
   * Crear nuevo mensaje
   */
  static async createMessage(
    data: CreateMessageRequest & { sender_id: number },
  ): Promise<MessageWithSender> {
    try {
      // Verificar que el chat existe y el usuario pertenece a él
      const chat = await Chat.findByPk(data.chat_id)
      if (!chat) {
        throw new Error('Chat no encontrado')
      }

      const chatData = chat.dataValues
      if (chatData.student_id !== data.sender_id && chatData.teacher_id !== data.sender_id) {
        throw new Error('No tienes permiso para enviar mensajes a este chat')
      }

      // Crear el mensaje
      const message = await Message.create({
        content: data.content,
        chat_id: data.chat_id,
        sender_id: data.sender_id,
      })

      // Obtener el mensaje con información del remitente
      const messageWithSender = await Message.findByPk(message.dataValues.id, {
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'email', 'name', 'lastname'],
          },
        ],
      })

      // Actualizar timestamp del chat
      await Chat.update({ updated_at: new Date() }, { where: { id: data.chat_id } })

      return messageWithSender!.dataValues
    } catch (error) {
      console.error('Error creating message:', error)
      throw error
    }
  }

  /**
   * Marcar mensajes como leídos
   */
  static async markMessagesAsRead(chatId: number, userId: number): Promise<number> {
    try {
      // Verificar que el usuario pertenece al chat
      const chat = await Chat.findByPk(chatId)
      if (!chat) {
        throw new Error('Chat no encontrado')
      }

      const chatData = chat.dataValues
      if (chatData.student_id !== userId && chatData.teacher_id !== userId) {
        throw new Error('No tienes permiso para acceder a este chat')
      }

      // Marcar como leídos todos los mensajes que no son del usuario actual
      const [updatedCount] = await Message.update(
        { is_read: true },
        {
          where: {
            chat_id: chatId,
            sender_id: { [Op.ne]: userId },
            is_read: false,
          },
        },
      )

      return updatedCount
    } catch (error) {
      console.error('Error marking messages as read:', error)
      throw error
    }
  }

  /**
   * Obtener mensajes de un chat con paginación
   */
  static async getChatMessages(
    chatId: number,
    userId: number,
    page: number = 1,
    limit: number = 50,
  ): Promise<{ messages: MessageWithSender[]; totalPages: number; currentPage: number }> {
    try {
      // Verificar acceso al chat
      const chat = await Chat.findByPk(chatId)
      if (!chat) {
        throw new Error('Chat no encontrado')
      }

      const chatData = chat.dataValues
      if (chatData.student_id !== userId && chatData.teacher_id !== userId) {
        throw new Error('No tienes permiso para acceder a este chat')
      }

      const offset = (page - 1) * limit

      const { count, rows } = await Message.findAndCountAll({
        where: { chat_id: chatId },
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'email', 'name', 'lastname'],
          },
        ],
        order: [['created_at', 'DESC']],
        limit,
        offset,
      })

      const totalPages = Math.ceil(count / limit)

      return {
        messages: rows.map((row: any) => row.dataValues).reverse(), // Invertir para orden cronológico
        totalPages,
        currentPage: page,
      }
    } catch (error) {
      console.error('Error getting chat messages:', error)
      throw error
    }
  }

  /**
   * Obtener estadísticas de chat
   */
  static async getChatStats(userId: number): Promise<{
    totalChats: number
    unreadMessages: number
    totalMessages: number
  }> {
    try {
      // Total de chats
      const totalChats = await Chat.count({
        where: {
          [Op.or]: [{ student_id: userId }, { teacher_id: userId }],
        },
      })

      // Mensajes no leídos
      const unreadMessages = await Message.count({
        include: [
          {
            model: Chat,
            as: 'chat',
            where: {
              [Op.or]: [{ student_id: userId }, { teacher_id: userId }],
            },
          },
        ],
        where: {
          sender_id: { [Op.ne]: userId },
          is_read: false,
        },
      })

      // Total de mensajes enviados
      const totalMessages = await Message.count({
        where: { sender_id: userId },
      })

      return {
        totalChats,
        unreadMessages,
        totalMessages,
      }
    } catch (error) {
      console.error('Error getting chat stats:', error)
      throw new Error('Error al obtener estadísticas de chat')
    }
  }
}
