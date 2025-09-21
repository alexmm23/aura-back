// Types for Forum module

export interface ForumCreationAttributes {
  title: string
  description?: string
  category: string
  grade?: string
  subject?: string
  career?: string
  is_active?: boolean
  created_by: number
}

export interface ForumAttributes extends ForumCreationAttributes {
  id: number
  created_at: Date
  updated_at: Date
}

export interface ForumPostCreationAttributes {
  forum_id: number
  title: string
  description: string
  user_id: number
  allow_responses?: boolean
  is_active?: boolean
}

export interface ForumPostAttributes extends ForumPostCreationAttributes {
  id: number
  created_at: Date
  updated_at: Date
}

export interface ForumCommentCreationAttributes {
  post_id: number
  user_id: number
  content: string
  parent_comment_id?: number // Para respuestas anidadas
  is_active?: boolean
}

export interface ForumCommentAttributes extends ForumCommentCreationAttributes {
  id: number
  created_at: Date
  updated_at: Date
}

export interface ForumAttachmentCreationAttributes {
  post_id?: number
  comment_id?: number
  user_id: number
  file_name: string
  file_url: string
  file_type: 'image' | 'document' | 'video' | 'link' | 'other'
  file_size?: number
}

export interface ForumAttachmentAttributes extends ForumAttachmentCreationAttributes {
  id: number
  created_at: Date
}

// Extended types with relationships
export interface ForumWithDetails extends ForumAttributes {
  creator?: {
    id: number
    name: string
    lastname: string
    email: string
  }
  posts_count?: number
  latest_activity?: Date
}

export interface ForumPostWithDetails extends ForumPostAttributes {
  user?: {
    id: number
    name: string
    lastname: string
    email: string
  }
  forum?: {
    id: number
    title: string
    category: string
  }
  attachments?: ForumAttachmentAttributes[]
  comments_count?: number
  latest_comment?: Date
}

export interface ForumCommentWithDetails extends ForumCommentAttributes {
  user?: {
    id: number
    name: string
    lastname: string
    email: string
  }
  attachments?: ForumAttachmentAttributes[]
  replies?: ForumCommentWithDetails[]
  replies_count?: number
}

// Request/Response types
export interface CreateForumRequest {
  title: string
  description?: string
  category: string
  grade?: string
  subject?: string
  career?: string
}

export interface CreatePostRequest {
  forum_id: number
  title: string
  description: string
  allow_responses?: boolean
  attachments?: {
    file_name: string
    file_url: string
    file_type: 'image' | 'document' | 'video' | 'link' | 'other'
    file_size?: number
  }[]
}

export interface CreateCommentRequest {
  post_id: number
  content: string
  parent_comment_id?: number
  attachments?: {
    file_name: string
    file_url: string
    file_type: 'image' | 'document' | 'video' | 'link' | 'other'
    file_size?: number
  }[]
}

export interface ForumFilters {
  category?: string
  grade?: string
  subject?: string
  career?: string
  is_active?: boolean
  search?: string
}

export interface PostFilters {
  forum_id?: number
  user_id?: number
  allow_responses?: boolean
  is_active?: boolean
  search?: string
}

export interface CommentFilters {
  post_id?: number
  user_id?: number
  parent_comment_id?: number
  is_active?: boolean
}
