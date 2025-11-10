declare module 'expo-server-sdk' {
  export type ExpoPushToken = string

  export interface ExpoPushMessage {
    to: ExpoPushToken
    title?: string
    body?: string
    subtitle?: string
  sound?: 'default' | null | string
    priority?: 'default' | 'high'
    channelId?: string
    data?: Record<string, unknown>
  }

  export interface ExpoPushTicket {
    id?: string
    status: 'ok' | 'error'
    message?: string
    details?: {
      error?: string
    }
  }

  export interface ExpoPushReceipt {
    status: 'ok' | 'error'
    message?: string
    details?: {
      error?: string
    }
  }

  export class Expo {
    constructor(options?: { accessToken?: string })
    static isExpoPushToken(token: string): boolean
    chunkPushNotifications(messages: ExpoPushMessage[]): ExpoPushMessage[][]
    sendPushNotificationsAsync(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]>
    chunkPushNotificationReceiptIds(receiptIds: string[]): string[][]
    getPushNotificationReceiptsAsync(receiptIds: string[]): Promise<Record<string, ExpoPushReceipt>>
  }
}
