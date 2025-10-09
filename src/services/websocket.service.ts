import { Server as SocketIOServer } from 'socket.io'
import { Server as HttpServer } from 'http'
import jwt from 'jsonwebtoken'
import env from '../config/enviroment.js'
import { ChatService } from './chat.service.js'
import { ChatStatus, SendMessageRequest, ChatSocketEvents } from '../types/chat.types.js'

export class WebSocketService {
  private io: SocketIOServer
  private chatRooms: Map<number, ChatStatus> = new Map()
  private userSockets: Map<number, Set<string>> = new Map()

  constructor(server: HttpServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: env.CORS_ORIGIN,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    })

    this.setupMiddleware()
    this.setupEventHandlers()
  }

  /**
   * Middleware de autenticación para WebSocket
   */
  private setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token =
          socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1]

        if (!token) {
          return next(new Error('Token de autenticación requerido'))
        }

        const decoded = jwt.verify(token, env.JWT_SECRET) as any
        socket.data.userId = decoded.id
        socket.data.userEmail = decoded.email

        console.log(`WebSocket authenticated: ${decoded.email} (${decoded.id})`)
        next()
      } catch (error) {
        console.error('WebSocket authentication error:', error)
        next(new Error('Token de autenticación inválido'))
      }
    })
  }

  /**
   * Configurar manejadores de eventos
   */
  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      const userId = socket.data.userId
      console.log(`Usuario conectado: ${socket.data.userEmail} (${userId})`)

      // Registrar socket del usuario
      this.registerUserSocket(userId, socket.id)

      // Notificar que el usuario está online
      this.broadcastUserOnlineStatus(userId, true)

      // Eventos de chat
      socket.on('join_chat', (chatId: number) => {
        this.handleJoinChat(socket, chatId)
      })

      socket.on('leave_chat', (chatId: number) => {
        this.handleLeaveChat(socket, chatId)
      })

      socket.on('send_message', async (data: SendMessageRequest) => {
        await this.handleSendMessage(socket, data)
      })

      socket.on('mark_messages_read', async (data: { chatId: number }) => {
        await this.handleMarkMessagesRead(socket, data.chatId)
      })

      socket.on('typing_start', (data: { chatId: number }) => {
        this.handleTyping(socket, data.chatId, true)
      })

      socket.on('typing_stop', (data: { chatId: number }) => {
        this.handleTyping(socket, data.chatId, false)
      })

      // Eventos de desconexión
      socket.on('disconnect', () => {
        this.handleDisconnect(socket)
      })
    })
  }

  /**
   * Registrar socket de usuario
   */
  private registerUserSocket(userId: number, socketId: string) {
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set())
    }
    this.userSockets.get(userId)!.add(socketId)
  }

  /**
   * Desregistrar socket de usuario
   */
  private unregisterUserSocket(userId: number, socketId: string) {
    const userSocketSet = this.userSockets.get(userId)
    if (userSocketSet) {
      userSocketSet.delete(socketId)
      if (userSocketSet.size === 0) {
        this.userSockets.delete(userId)
        // Usuario completamente desconectado
        this.broadcastUserOnlineStatus(userId, false)
      }
    }
  }

  /**
   * Manejar unión a chat
   */
  private async handleJoinChat(socket: any, chatId: number) {
    try {
      const userId = socket.data.userId

      // Verificar acceso al chat
      const chat = await ChatService.getChatById(chatId, userId)
      if (!chat) {
        socket.emit('error', { message: 'No tienes acceso a este chat' })
        return
      }

      // Unirse al room
      socket.join(`chat_${chatId}`)

      // Actualizar estado del chat
      if (!this.chatRooms.has(chatId)) {
        this.chatRooms.set(chatId, {
          chatId,
          participants: [chat.student_id, chat.teacher_id],
          onlineUsers: new Set(),
          typingUsers: new Set(),
        })
      }

      const chatStatus = this.chatRooms.get(chatId)!
      chatStatus.onlineUsers.add(userId)

      // Notificar a otros participantes
      socket.to(`chat_${chatId}`).emit('user_joined_chat', {
        chatId,
        userId,
        onlineUsers: Array.from(chatStatus.onlineUsers),
      })

      console.log(`Usuario ${userId} se unió al chat ${chatId}`)
    } catch (error) {
      console.error('Error joining chat:', error)
      socket.emit('error', { message: 'Error al unirse al chat' })
    }
  }

  /**
   * Manejar salida de chat
   */
  private handleLeaveChat(socket: any, chatId: number) {
    const userId = socket.data.userId

    socket.leave(`chat_${chatId}`)

    const chatStatus = this.chatRooms.get(chatId)
    if (chatStatus) {
      chatStatus.onlineUsers.delete(userId)
      chatStatus.typingUsers.delete(userId)

      // Notificar a otros participantes
      socket.to(`chat_${chatId}`).emit('user_left_chat', {
        chatId,
        userId,
        onlineUsers: Array.from(chatStatus.onlineUsers),
      })

      // Limpiar chat si no hay usuarios
      if (chatStatus.onlineUsers.size === 0) {
        this.chatRooms.delete(chatId)
      }
    }

    console.log(`Usuario ${userId} salió del chat ${chatId}`)
  }

  /**
   * Manejar envío de mensaje
   */
  private async handleSendMessage(socket: any, data: SendMessageRequest) {
    try {
      const userId = socket.data.userId

      // Crear mensaje usando el servicio
      const message = await ChatService.createMessage({
        content: data.content,
        chat_id: data.chat_id,
        sender_id: userId,
      })

      // Emitir mensaje a todos los participantes del chat
      this.io.to(`chat_${data.chat_id}`).emit('new_message', {
        message,
        chatId: data.chat_id,
      })

      // Notificar a usuarios offline si es necesario
      await this.notifyOfflineUsers(data.chat_id, userId, message)

      console.log(`Mensaje enviado en chat ${data.chat_id} por usuario ${userId}`)
    } catch (error) {
      console.error('Error sending message:', error)
      socket.emit('error', { message: 'Error al enviar mensaje' })
    }
  }

  /**
   * Manejar marcar mensajes como leídos
   */
  private async handleMarkMessagesRead(socket: any, chatId: number) {
    try {
      const userId = socket.data.userId

      const updatedCount = await ChatService.markMessagesAsRead(chatId, userId)

      if (updatedCount > 0) {
        // Notificar a otros participantes
        socket.to(`chat_${chatId}`).emit('messages_read', {
          chatId,
          userId,
          count: updatedCount,
        })
      }
    } catch (error) {
      console.error('Error marking messages as read:', error)
      socket.emit('error', { message: 'Error al marcar mensajes como leídos' })
    }
  }

  /**
   * Manejar indicador de escritura
   */
  private handleTyping(socket: any, chatId: number, isTyping: boolean) {
    const userId = socket.data.userId

    const chatStatus = this.chatRooms.get(chatId)
    if (!chatStatus) return

    if (isTyping) {
      chatStatus.typingUsers.add(userId)
    } else {
      chatStatus.typingUsers.delete(userId)
    }

    // Notificar a otros participantes
    socket.to(`chat_${chatId}`).emit('user_typing', {
      chatId,
      userId,
      isTyping,
      typingUsers: Array.from(chatStatus.typingUsers),
    })
  }

  /**
   * Manejar desconexión
   */
  private handleDisconnect(socket: any) {
    const userId = socket.data.userId
    console.log(`Usuario desconectado: ${socket.data.userEmail} (${userId})`)

    // Desregistrar socket
    this.unregisterUserSocket(userId, socket.id)

    // Salir de todos los chats
    this.chatRooms.forEach((chatStatus, chatId) => {
      if (chatStatus.onlineUsers.has(userId)) {
        chatStatus.onlineUsers.delete(userId)
        chatStatus.typingUsers.delete(userId)

        // Notificar a otros participantes
        socket.to(`chat_${chatId}`).emit('user_left_chat', {
          chatId,
          userId,
          onlineUsers: Array.from(chatStatus.onlineUsers),
        })
      }
    })
  }

  /**
   * Transmitir estado online del usuario
   */
  private broadcastUserOnlineStatus(userId: number, online: boolean) {
    this.io.emit('user_online_status', { userId, online })
  }

  /**
   * Notificar a usuarios offline (para push notifications futuras)
   */
  private async notifyOfflineUsers(chatId: number, senderId: number, message: any) {
    try {
      const chat = await ChatService.getChatById(chatId, senderId)
      if (!chat) return

      const recipientId = chat.student_id === senderId ? chat.teacher_id : chat.student_id

      // Si el destinatario no está online, aquí podrías integrar push notifications
      const isRecipientOnline = this.userSockets.has(recipientId)

      if (!isRecipientOnline) {
        console.log(`Usuario ${recipientId} offline, mensaje pendiente de notificación`)
        // TODO: Integrar con servicio de push notifications
      }
    } catch (error) {
      console.error('Error notifying offline users:', error)
    }
  }

  /**
   * Obtener usuarios online en un chat
   */
  public getChatOnlineUsers(chatId: number): number[] {
    const chatStatus = this.chatRooms.get(chatId)
    return chatStatus ? Array.from(chatStatus.onlineUsers) : []
  }

  /**
   * Verificar si un usuario está online
   */
  public isUserOnline(userId: number): boolean {
    return this.userSockets.has(userId)
  }

  /**
   * Obtener instancia de Socket.IO para uso externo
   */
  public getIO(): SocketIOServer {
    return this.io
  }
}

// Singleton para uso global
let webSocketService: WebSocketService

export const initWebSocketService = (server: HttpServer): WebSocketService => {
  if (!webSocketService) {
    webSocketService = new WebSocketService(server)
  }
  return webSocketService
}

export const getWebSocketService = (): WebSocketService => {
  if (!webSocketService) {
    throw new Error('WebSocket service not initialized')
  }
  return webSocketService
}
