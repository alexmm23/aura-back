// Types for Reminders module

export interface ReminderCreationAttributes {
  title: string
  description?: string
  date_time: Date
  frequency?: 'once' | 'daily' | 'weekly' | 'monthly'
  status?: 'pending' | 'sent'
  user_id: number
  deleted?: boolean
}

export interface ReminderAttributes extends ReminderCreationAttributes {
  id: number
  created_at: Date
}

export interface ReminderUpdateAttributes {
  title?: string
  description?: string
  date_time?: Date
  frequency?: 'once' | 'daily' | 'weekly' | 'monthly'
  status?: 'pending' | 'sent'
}

// Extended types with relationships
export interface ReminderWithUser extends ReminderAttributes {
  user?: {
    id: number
    name: string
    lastname: string
    email: string
  }
}

// Request/Response types
export interface CreateReminderRequest {
  title: string
  description?: string
  date_time: string | Date
  frequency?: 'once' | 'daily' | 'weekly' | 'monthly'
}

export interface UpdateReminderRequest {
  title?: string
  description?: string
  date_time?: string | Date
  frequency?: 'once' | 'daily' | 'weekly' | 'monthly'
  status?: 'pending' | 'sent'
}

// Filter types
export interface ReminderFilters {
  status?: 'pending' | 'sent'
  frequency?: 'once' | 'daily' | 'weekly' | 'monthly'
  date_from?: string | Date
  date_to?: string | Date
  search?: string
  user_id?: number
}

// Pagination
export interface PaginatedReminders {
  reminders: ReminderWithUser[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface PaginationOptions {
  page?: number
  limit?: number
  sort_by?: 'date_time' | 'created_at' | 'title'
  sort_order?: 'ASC' | 'DESC'
}