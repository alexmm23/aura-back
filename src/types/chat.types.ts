// Tipos para el sistema de chat
export interface ChatAttributes {
  id: number
  student_id: number
  teacher_id: number
  created_at: Date
  updated_at?: Date
}

export interface CreateChatRequest {
  targetUserId: number
  userId?: number
}

export interface MessageAttributes {
  id: number
  content: string
  chat_id: number
  sender_id: number
  created_at: Date
  is_read: boolean
}

export interface CreateMessageRequest {
  content: string
  chat_id: number
}

export interface SendMessageRequest {
  content: string
  chat_id: number
  sender_id: number
}

// Eventos de WebSocket
export interface ChatSocketEvents {
  join_chat: (chatId: number) => void
  leave_chat: (chatId: number) => void
  send_message: (data: SendMessageRequest) => void
  new_message: (message: MessageWithSender) => void
  message_read: (data: { messageId: number; chatId: number }) => void
  user_typing: (data: { chatId: number; userId: number; isTyping: boolean }) => void
  user_online: (data: { userId: number; online: boolean }) => void
}

// Mensaje con información del remitente
export interface MessageWithSender extends MessageAttributes {
  sender: {
    id: number
    email: string
    name?: string
  }
}

// Chat con información completa
export interface ChatWithDetails extends ChatAttributes {
  student: {
    id: number
    email: string
    name?: string
  }
  teacher: {
    id: number
    email: string
    name?: string
  }
  messages?: MessageWithSender[]
  unread_count?: number
  last_message?: MessageWithSender
}

// Estados de chat
export interface ChatStatus {
  chatId: number
  participants: number[]
  onlineUsers: Set<number>
  typingUsers: Set<number>
}
