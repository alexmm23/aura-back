import { Forum } from '../models/forum.model.js'
import { ForumPost } from '../models/forumPost.model.js'
import { ForumComment } from '../models/forumComment.model.js'
import { ForumAttachment } from '../models/forumAttachment.model.js'
import { User } from '../models/user.model.js'
import {
  ForumCreationAttributes,
  ForumAttributes,
  ForumPostCreationAttributes,
  ForumPostAttributes,
  ForumCommentCreationAttributes,
  ForumCommentAttributes,
  ForumAttachmentCreationAttributes,
  ForumFilters,
  PostFilters,
  CommentFilters,
  CreateForumRequest,
  CreatePostRequest,
  CreateCommentRequest,
  ForumWithDetails,
  ForumPostWithDetails,
  ForumCommentWithDetails,
} from '../types/forum.types.js'
import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const { Op } = require('sequelize')

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ==================== FORUM SERVICES ====================

export const getAllForums = async (filters: ForumFilters = {}): Promise<ForumWithDetails[]> => {
  try {
    const whereConditions: any = {}

    if (filters.category) whereConditions.category = filters.category
    if (filters.grade) whereConditions.grade = filters.grade
    if (filters.subject) whereConditions.subject = filters.subject
    if (filters.career) whereConditions.career = filters.career
    if (filters.is_active !== undefined) whereConditions.is_active = filters.is_active
    if (filters.search) {
      whereConditions[Op.or] = [
        { title: { [Op.like]: `%${filters.search}%` } },
        { description: { [Op.like]: `%${filters.search}%` } },
      ]
    }

    const forums = await Forum.findAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'lastname', 'email'],
        },
      ],
      order: [['created_at', 'DESC']],
    })

    // Agregar conteo de posts y última actividad
    const forumsWithDetails = await Promise.all(
      forums.map(async (forum: any) => {
        const postsCount = await ForumPost.count({
          where: { forum_id: forum.id, is_active: true },
        })

        const latestPost = await ForumPost.findOne({
          where: { forum_id: forum.id, is_active: true },
          order: [['created_at', 'DESC']],
          attributes: ['created_at'],
        })

        return {
          ...forum.toJSON(),
          posts_count: postsCount,
          latest_activity: latestPost?.getDataValue('created_at') || forum.created_at,
        }
      }),
    )

    return forumsWithDetails
  } catch (error: any) {
    console.error('Error fetching forums:', error)
    throw new Error('Error fetching forums: ' + error.message)
  }
}

export const getForumById = async (id: number): Promise<ForumWithDetails | null> => {
  try {
    const forum = await Forum.findOne({
      where: { id, is_active: true },
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'lastname', 'email'],
        },
      ],
    })

    if (!forum) return null

    const postsCount = await ForumPost.count({
      where: { forum_id: id, is_active: true },
    })

    const latestPost = await ForumPost.findOne({
      where: { forum_id: id, is_active: true },
      order: [['created_at', 'DESC']],
      attributes: ['created_at'],
    })

    return {
      ...forum.toJSON(),
      posts_count: postsCount,
      latest_activity: latestPost?.getDataValue('created_at') || forum.getDataValue('created_at'),
    }
  } catch (error: any) {
    console.error('Error fetching forum:', error)
    throw new Error('Error fetching forum: ' + error.message)
  }
}

export const createForum = async (
  forumData: CreateForumRequest,
  userId: number,
): Promise<ForumAttributes> => {
  try {
    const newForum = await Forum.create({
      ...forumData,
      created_by: userId,
    })

    return newForum.toJSON() as ForumAttributes
  } catch (error: any) {
    console.error('Error creating forum:', error)
    throw new Error('Error creating forum: ' + error.message)
  }
}

export const updateForum = async (
  id: number,
  forumData: Partial<ForumCreationAttributes>,
  userId: number,
): Promise<ForumAttributes | null> => {
  try {
    const forum = await Forum.findOne({ where: { id, is_active: true } })

    if (!forum) {
      throw new Error('Forum not found')
    }

    // Solo el creador o admin puede editar
    if (forum.getDataValue('created_by') !== userId) {
      throw new Error('Unauthorized to edit this forum')
    }

    await forum.update({
      ...forumData,
      updated_at: new Date(),
    })

    return forum.toJSON() as ForumAttributes
  } catch (error: any) {
    console.error('Error updating forum:', error)
    throw new Error('Error updating forum: ' + error.message)
  }
}

export const deleteForum = async (id: number, userId: number): Promise<boolean> => {
  try {
    const forum = await Forum.findOne({ where: { id, is_active: true } })

    if (!forum) {
      throw new Error('Forum not found')
    }

    // Solo el creador puede eliminar
    if (forum.getDataValue('created_by') !== userId) {
      throw new Error('Unauthorized to delete this forum')
    }

    await forum.update({ is_active: false })
    return true
  } catch (error: any) {
    console.error('Error deleting forum:', error)
    throw new Error('Error deleting forum: ' + error.message)
  }
}

// ==================== FORUM POST SERVICES ====================

export const getPostsByForum = async (
  forumId: number,
  filters: PostFilters = {},
): Promise<ForumPostWithDetails[]> => {
  try {
    const whereConditions: any = { forum_id: forumId }

    if (filters.user_id) whereConditions.user_id = filters.user_id
    if (filters.allow_responses !== undefined)
      whereConditions.allow_responses = filters.allow_responses
    if (filters.is_active !== undefined) whereConditions.is_active = filters.is_active
    if (filters.search) {
      whereConditions[Op.or] = [
        { title: { [Op.like]: `%${filters.search}%` } },
        { description: { [Op.like]: `%${filters.search}%` } },
      ]
    }

    const posts = await ForumPost.findAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'lastname', 'email'],
        },
        {
          model: Forum,
          as: 'forum',
          attributes: ['id', 'title', 'category'],
        },
        {
          model: ForumAttachment,
          as: 'attachments',
        },
      ],
      order: [['created_at', 'DESC']],
    })

    // Agregar conteo de comentarios y última actividad
    const postsWithDetails = await Promise.all(
      posts.map(async (post: any) => {
        const commentsCount = await ForumComment.count({
          where: { post_id: post.id, is_active: true },
        })

        const latestComment = await ForumComment.findOne({
          where: { post_id: post.id, is_active: true },
          order: [['created_at', 'DESC']],
          attributes: ['created_at'],
        })

        return {
          ...post.toJSON(),
          comments_count: commentsCount,
          latest_comment: latestComment?.getDataValue('created_at'),
        }
      }),
    )

    return postsWithDetails
  } catch (error: any) {
    console.error('Error fetching posts:', error)
    throw new Error('Error fetching posts: ' + error.message)
  }
}

export const getPostById = async (id: number): Promise<ForumPostWithDetails | null> => {
  try {
    const post = await ForumPost.findOne({
      where: { id, is_active: true },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'lastname', 'email'],
        },
        {
          model: Forum,
          as: 'forum',
          attributes: ['id', 'title', 'category'],
        },
        {
          model: ForumAttachment,
          as: 'attachments',
        },
      ],
    })

    if (!post) return null

    const commentsCount = await ForumComment.count({
      where: { post_id: id, is_active: true },
    })

    const latestComment = await ForumComment.findOne({
      where: { post_id: id, is_active: true },
      order: [['created_at', 'DESC']],
      attributes: ['created_at'],
    })

    return {
      ...post.toJSON(),
      comments_count: commentsCount,
      latest_comment: latestComment?.getDataValue('created_at'),
    }
  } catch (error: any) {
    console.error('Error fetching post:', error)
    throw new Error('Error fetching post: ' + error.message)
  }
}

export const createPost = async (
  postData: CreatePostRequest,
  userId: number,
): Promise<ForumPostWithDetails> => {
  try {
    // Verificar que el foro existe
    const forum = await Forum.findOne({
      where: { id: postData.forum_id, is_active: true },
    })

    if (!forum) {
      throw new Error('Forum not found')
    }

    // Crear el post
    const newPost = await ForumPost.create({
      forum_id: postData.forum_id,
      title: postData.title,
      description: postData.description,
      user_id: userId,
      allow_responses: postData.allow_responses ?? true,
    })

    // Crear attachments si existen
    if (postData.attachments && postData.attachments.length > 0) {
      await Promise.all(
        postData.attachments.map((attachment) =>
          ForumAttachment.create({
            post_id: newPost.getDataValue('id'),
            user_id: userId,
            file_name: attachment.file_name,
            file_url: attachment.file_url,
            file_type: attachment.file_type,
            file_size: attachment.file_size,
          }),
        ),
      )
    }

    // Obtener el post completo con relaciones
    const postWithDetails = await getPostById(newPost.getDataValue('id'))
    return postWithDetails!
  } catch (error: any) {
    console.error('Error creating post:', error)
    throw new Error('Error creating post: ' + error.message)
  }
}

export const updatePost = async (
  id: number,
  postData: Partial<CreatePostRequest>,
  userId: number,
): Promise<ForumPostWithDetails | null> => {
  try {
    const post = await ForumPost.findOne({ where: { id, is_active: true } })

    if (!post) {
      throw new Error('Post not found')
    }

    // Solo el creador puede editar
    if (post.getDataValue('user_id') !== userId) {
      throw new Error('Unauthorized to edit this post')
    }

    await post.update({
      ...postData,
      updated_at: new Date(),
    })

    const updatedPost = await getPostById(id)
    return updatedPost
  } catch (error: any) {
    console.error('Error updating post:', error)
    throw new Error('Error updating post: ' + error.message)
  }
}

export const togglePostResponses = async (
  id: number,
  userId: number,
  isAdmin: boolean = false,
): Promise<boolean> => {
  try {
    const post = await ForumPost.findOne({ where: { id, is_active: true } })

    if (!post) {
      throw new Error('Post not found')
    }

    // Solo el creador o admin puede cambiar este setting
    if (post.getDataValue('user_id') !== userId && !isAdmin) {
      throw new Error('Unauthorized to modify response settings')
    }

    const currentSetting = post.getDataValue('allow_responses')
    await post.update({
      allow_responses: !currentSetting,
      updated_at: new Date(),
    })

    return !currentSetting
  } catch (error: any) {
    console.error('Error toggling post responses:', error)
    throw new Error('Error toggling post responses: ' + error.message)
  }
}

export const deletePost = async (id: number, userId: number): Promise<boolean> => {
  try {
    const post = await ForumPost.findOne({ where: { id, is_active: true } })

    if (!post) {
      throw new Error('Post not found')
    }

    // Solo el creador puede eliminar
    if (post.getDataValue('user_id') !== userId) {
      throw new Error('Unauthorized to delete this post')
    }

    await post.update({ is_active: false })
    return true
  } catch (error: any) {
    console.error('Error deleting post:', error)
    throw new Error('Error deleting post: ' + error.message)
  }
}

// ==================== FORUM COMMENT SERVICES ====================

export const getCommentsByPost = async (
  postId: number,
  filters: CommentFilters = {},
): Promise<ForumCommentWithDetails[]> => {
  try {
    const whereConditions: any = {
      post_id: postId,
      parent_comment_id: null, // Solo comentarios principales
    }

    if (filters.user_id) whereConditions.user_id = filters.user_id
    if (filters.is_active !== undefined) whereConditions.is_active = filters.is_active

    const comments = await ForumComment.findAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'lastname', 'email'],
        },
        {
          model: ForumAttachment,
          as: 'attachments',
        },
      ],
      order: [['created_at', 'ASC']],
    })

    // Obtener respuestas para cada comentario
    const commentsWithReplies = await Promise.all(
      comments.map(async (comment: any) => {
        const replies = await ForumComment.findAll({
          where: {
            parent_comment_id: comment.id,
            is_active: true,
          },
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'name', 'lastname', 'email'],
            },
            {
              model: ForumAttachment,
              as: 'attachments',
            },
          ],
          order: [['created_at', 'ASC']],
        })

        return {
          ...comment.toJSON(),
          replies: replies.map((reply: any) => reply.toJSON()),
          replies_count: replies.length,
        }
      }),
    )

    return commentsWithReplies
  } catch (error: any) {
    console.error('Error fetching comments:', error)
    throw new Error('Error fetching comments: ' + error.message)
  }
}

export const createComment = async (
  commentData: CreateCommentRequest,
  userId: number,
): Promise<ForumCommentWithDetails> => {
  try {
    // Verificar que el post existe y permite respuestas
    const post = await ForumPost.findOne({
      where: { id: commentData.post_id, is_active: true },
    })

    if (!post) {
      throw new Error('Post not found')
    }

    if (!post.getDataValue('allow_responses')) {
      throw new Error('Responses are not allowed for this post')
    }

    // Si es una respuesta, verificar que el comentario padre existe
    if (commentData.parent_comment_id) {
      const parentComment = await ForumComment.findOne({
        where: { id: commentData.parent_comment_id, is_active: true },
      })

      if (!parentComment) {
        throw new Error('Parent comment not found')
      }
    }

    // Crear el comentario
    const newComment = await ForumComment.create({
      post_id: commentData.post_id,
      user_id: userId,
      content: commentData.content,
      parent_comment_id: commentData.parent_comment_id || null,
    })

    // Procesar archivos adjuntos si existen
    if (commentData.attachments && commentData.attachments.length > 0) {
      const storageDir = path.join(process.cwd(), 'storage', 'images')

      // Crear directorio si no existe
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true })
      }

      const attachmentPromises = commentData.attachments.map(async (attachment) => {
        try {
          // Generar nombre único para el archivo
          const timestamp = Date.now()
          const randomString = Math.random().toString(36).substring(2, 15)
          const extension = attachment.name.split('.').pop() || 'png'
          const fileName = `forum_comment_${newComment.getDataValue('id')}_${timestamp}_${randomString}.${extension}`
          const filePath = path.join(storageDir, fileName)

          // Convertir base64 a buffer y guardar
          const base64Data = attachment.data.replace(/^data:.*?;base64,/, '')
          const buffer = Buffer.from(base64Data, 'base64')
          fs.writeFileSync(filePath, buffer)

          // Determinar tipo de archivo
          let fileType: 'image' | 'document' | 'video' | 'link' | 'other' = 'other'
          if (attachment.type.startsWith('image/')) {
            fileType = 'image'
          } else if (attachment.type.startsWith('video/')) {
            fileType = 'video'
          } else if (
            attachment.type.includes('pdf') ||
            attachment.type.includes('document') ||
            attachment.type.includes('word') ||
            attachment.type.includes('excel') ||
            attachment.type.includes('powerpoint')
          ) {
            fileType = 'document'
          }

          // Calcular tamaño del archivo
          const fileSize = buffer.length

          // Crear registro en la base de datos
          return ForumAttachment.create({
            comment_id: newComment.getDataValue('id'),
            user_id: userId,
            file_name: attachment.name,
            file_url: `/storage/images/${fileName}`,
            file_type: fileType,
            file_size: fileSize,
          })
        } catch (error) {
          console.error('Error saving attachment:', error)
          throw error
        }
      })

      await Promise.all(attachmentPromises)
    }

    // Procesar links si existen
    if (commentData.links && commentData.links.length > 0) {
      const linkPromises = commentData.links.map((linkUrl) =>
        ForumAttachment.create({
          comment_id: newComment.getDataValue('id'),
          user_id: userId,
          file_name: 'Link',
          file_url: linkUrl,
          file_type: 'link',
          file_size: 0,
        }),
      )

      await Promise.all(linkPromises)
    }

    // Obtener el comentario completo con relaciones
    const commentWithDetails = await ForumComment.findOne({
      where: { id: newComment.getDataValue('id') },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'lastname', 'email'],
        },
        {
          model: ForumAttachment,
          as: 'attachments',
        },
      ],
    })

    return commentWithDetails!.toJSON() as ForumCommentWithDetails
  } catch (error: any) {
    console.error('Error creating comment:', error)
    throw new Error('Error creating comment: ' + error.message)
  }
}

export const updateComment = async (
  id: number,
  content: string,
  userId: number,
): Promise<ForumCommentAttributes | null> => {
  try {
    const comment = await ForumComment.findOne({ where: { id, is_active: true } })

    if (!comment) {
      throw new Error('Comment not found')
    }

    // Solo el creador puede editar
    if (comment.getDataValue('user_id') !== userId) {
      throw new Error('Unauthorized to edit this comment')
    }

    await comment.update({
      content,
      updated_at: new Date(),
    })

    return comment.toJSON() as ForumCommentAttributes
  } catch (error: any) {
    console.error('Error updating comment:', error)
    throw new Error('Error updating comment: ' + error.message)
  }
}

export const deleteComment = async (id: number, userId: number): Promise<boolean> => {
  try {
    const comment = await ForumComment.findOne({ where: { id, is_active: true } })

    if (!comment) {
      throw new Error('Comment not found')
    }

    // Solo el creador puede eliminar
    if (comment.getDataValue('user_id') !== userId) {
      throw new Error('Unauthorized to delete this comment')
    }

    await comment.update({ is_active: false })
    return true
  } catch (error: any) {
    console.error('Error deleting comment:', error)
    throw new Error('Error deleting comment: ' + error.message)
  }
}

// ==================== ATTACHMENT SERVICES ====================

export const deleteAttachment = async (id: number, userId: number): Promise<boolean> => {
  try {
    const attachment = await ForumAttachment.findOne({ where: { id } })

    if (!attachment) {
      throw new Error('Attachment not found')
    }

    // Solo el creador puede eliminar
    if (attachment.getDataValue('user_id') !== userId) {
      throw new Error('Unauthorized to delete this attachment')
    }

    await attachment.destroy()
    return true
  } catch (error: any) {
    console.error('Error deleting attachment:', error)
    throw new Error('Error deleting attachment: ' + error.message)
  }
}
