export interface RegisterPushTokenRequest {
  token: string
  deviceType?: string
  deviceName?: string
  osName?: string
  osVersion?: string
  appVersion?: string
  metadata?: Record<string, unknown>
}

export interface NotificationPayload {
  userId: number
  title: string
  body: string
  data?: Record<string, unknown>
  subtitle?: string
  sound?: string | null
  priority?: 'default' | 'normal' | 'high'
  channel?: string
}

export type NotificationCategory =
  | 'reminder_created'
  | 'reminder_due'
  | 'reminder_upcoming'
  | 'assignment_new'
  | 'general'

export interface AssignmentNotificationPayload {
  userId: number
  platform: 'moodle' | 'classroom'
  assignmentId: string
  title: string
  courseName?: string
  dueDate?: Date | null
}
