import { Router, Request, Response } from 'express'
import { authenticateToken } from '@/middlewares/auth.middleware'
import { UserAttributes } from '@/types/user.types'
import env from '@/config/enviroment'
import {
  getAllForums,
  getForumById,
  createForum,
  updateForum,
  deleteForum,
  getPostsByForum,
  getPostById,
  createPost,
  updatePost,
  togglePostResponses,
  deletePost,
  getCommentsByPost,
  createComment,
  updateComment,
  deleteComment,
  deleteAttachment,
} from '@/services/forum.service'
import {
  CreateForumRequest,
  CreatePostRequest,
  CreateCommentRequest,
  ForumFilters,
  PostFilters,
  CommentFilters,
} from '@/types/forum.types'

const forumRouter = Router()

// ==================== FORUM ROUTES ====================

// GET /forums - Obtener todos los foros con filtros
forumRouter.get('/', async (req: Request, res: Response) => {
  try {
    const filters: ForumFilters = {
      category: req.query.category as string,
      grade: req.query.grade as string,
      subject: req.query.subject as string,
      career: req.query.career as string,
      search: req.query.search as string,
      is_active: req.query.is_active ? req.query.is_active === 'true' : undefined,
    }

    const forums = await getAllForums(filters)
    res.status(200).json({
      success: true,
      data: forums,
      count: forums.length,
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

// GET /forums/:id - Obtener un foro específico
forumRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        error: 'Invalid forum ID',
      })
      return
    }

    const forum = await getForumById(id)
    if (!forum) {
      res.status(404).json({
        success: false,
        error: 'Forum not found',
      })
      return
    }

    res.status(200).json({
      success: true,
      data: forum,
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

// POST /forums - Crear nuevo foro (requiere autenticación)
forumRouter.post(
  '/',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const { user } = req
      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        })
        return
      }

      const forumData: CreateForumRequest = req.body

      // Validaciones básicas
      if (!forumData.title || !forumData.category) {
        res.status(400).json({
          success: false,
          error: 'Title and category are required',
        })
        return
      }

      const newForum = await createForum(forumData, user.id!)
      res.status(201).json({
        success: true,
        data: newForum,
        message: 'Forum created successfully',
      })
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      })
    }
  },
)

// PUT /forums/:id - Actualizar foro (solo creador)
forumRouter.put(
  '/:id',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const { user } = req
      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        })
        return
      }

      const id = parseInt(req.params.id)
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid forum ID',
        })
        return
      }

      const updatedForum = await updateForum(id, req.body, user.id!)
      res.status(200).json({
        success: true,
        data: updatedForum,
        message: 'Forum updated successfully',
      })
    } catch (error: any) {
      res.status(403).json({
        success: false,
        error: error.message,
      })
    }
  },
)

// DELETE /forums/:id - Eliminar foro (solo creador)
forumRouter.delete(
  '/:id',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const { user } = req
      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        })
        return
      }

      const id = parseInt(req.params.id)
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid forum ID',
        })
        return
      }

      await deleteForum(id, user.id!)
      res.status(200).json({
        success: true,
        message: 'Forum deleted successfully',
      })
    } catch (error: any) {
      res.status(403).json({
        success: false,
        error: error.message,
      })
    }
  },
)

// ==================== FORUM POSTS ROUTES ====================

// GET /forums/:forumId/posts - Obtener posts de un foro
forumRouter.get('/:forumId/posts', async (req: Request, res: Response) => {
  try {
    const forumId = parseInt(req.params.forumId)
    if (isNaN(forumId)) {
      res.status(400).json({
        success: false,
        error: 'Invalid forum ID',
      })
      return
    }

    const filters: PostFilters = {
      user_id: req.query.user_id ? parseInt(req.query.user_id as string) : undefined,
      allow_responses: req.query.allow_responses ? req.query.allow_responses === 'true' : undefined,
      search: req.query.search as string,
      is_active: req.query.is_active ? req.query.is_active === 'true' : undefined,
    }

    const posts = await getPostsByForum(forumId, filters)
    res.status(200).json({
      success: true,
      data: posts,
      count: posts.length,
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

// GET /posts/:id - Obtener un post específico
forumRouter.get('/posts/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        error: 'Invalid post ID',
      })
      return
    }

    const post = await getPostById(id)
    if (!post) {
      res.status(404).json({
        success: false,
        error: 'Post not found',
      })
      return
    }

    res.status(200).json({
      success: true,
      data: post,
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

// POST /forums/:forumId/posts - Crear nuevo post (requiere autenticación)
forumRouter.post(
  '/:forumId/posts',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const { user } = req
      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        })
        return
      }

      const forumId = parseInt(req.params.forumId)
      if (isNaN(forumId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid forum ID',
        })
        return
      }

      const postData: CreatePostRequest = {
        ...req.body,
        forum_id: forumId,
      }

      // Validaciones básicas
      if (!postData.title || !postData.description) {
        res.status(400).json({
          success: false,
          error: 'Title and description are required',
        })
        return
      }

      const newPost = await createPost(postData, user.id!)
      res.status(201).json({
        success: true,
        data: newPost,
        message: 'Post created successfully',
      })
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      })
    }
  },
)

// PUT /posts/:id - Actualizar post (solo creador)
forumRouter.put(
  '/posts/:id',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const { user } = req
      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        })
        return
      }

      const id = parseInt(req.params.id)
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid post ID',
        })
        return
      }

      const updatedPost = await updatePost(id, req.body, user.id!)
      res.status(200).json({
        success: true,
        data: updatedPost,
        message: 'Post updated successfully',
      })
    } catch (error: any) {
      res.status(403).json({
        success: false,
        error: error.message,
      })
    }
  },
)

// PATCH /posts/:id/toggle-responses - Toggle respuestas permitidas (creador o admin)
forumRouter.patch(
  '/posts/:id/toggle-responses',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const { user } = req
      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        })
        return
      }

      const id = parseInt(req.params.id)
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid post ID',
        })
        return
      }

      // Determinar si es admin (puedes ajustar esta lógica según tu sistema de roles)
      const isAdmin = user.role_id === 1 // Asumiendo que role_id 1 es admin

      const newSetting = await togglePostResponses(id, user.id!, isAdmin)
      res.status(200).json({
        success: true,
        data: { allow_responses: newSetting },
        message: `Responses ${newSetting ? 'enabled' : 'disabled'} for this post`,
      })
    } catch (error: any) {
      res.status(403).json({
        success: false,
        error: error.message,
      })
    }
  },
)

// DELETE /posts/:id - Eliminar post (solo creador)
forumRouter.delete(
  '/posts/:id',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const { user } = req
      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        })
        return
      }

      const id = parseInt(req.params.id)
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid post ID',
        })
        return
      }

      await deletePost(id, user.id!)
      res.status(200).json({
        success: true,
        message: 'Post deleted successfully',
      })
    } catch (error: any) {
      res.status(403).json({
        success: false,
        error: error.message,
      })
    }
  },
)

// ==================== COMMENTS ROUTES ====================

// GET /posts/:postId/comments - Obtener comentarios de un post
forumRouter.get('/posts/:postId/comments', async (req: Request, res: Response) => {
  try {
    const postId = parseInt(req.params.postId)
    if (isNaN(postId)) {
      res.status(400).json({
        success: false,
        error: 'Invalid post ID',
      })
      return
    }

    const filters: CommentFilters = {
      user_id: req.query.user_id ? parseInt(req.query.user_id as string) : undefined,
      is_active: req.query.is_active ? req.query.is_active === 'true' : undefined,
    }

    const comments = await getCommentsByPost(postId, filters)
    res.status(200).json({
      success: true,
      data: comments,
      count: comments.length,
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

// POST /posts/:postId/comments - Crear nuevo comentario (requiere autenticación)
forumRouter.post(
  '/posts/:postId/comments',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const { user } = req
      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        })
        return
      }

      const postId = parseInt(req.params.postId)
      if (isNaN(postId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid post ID',
        })
        return
      }

      const commentData: CreateCommentRequest = {
        ...req.body,
        post_id: postId,
      }

      // Validaciones básicas
      if (!commentData.content) {
        res.status(400).json({
          success: false,
          error: 'Content is required',
        })
        return
      }

      const newComment = await createComment(commentData, user.id!)

      // Determinar la URL base según el entorno
      const baseUrl =
        env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://back.aurapp.com.mx'

      // Agregar URL completa a los attachments
      if (newComment.attachments && newComment.attachments.length > 0) {
        newComment.attachments = newComment.attachments.map((attachment: any) => {
          if (attachment.file_type !== 'link' && !attachment.file_url.startsWith('http')) {
            return {
              ...attachment,
              file_url: `${baseUrl}${attachment.file_url}`,
            }
          }
          return attachment
        })
      }

      res.status(201).json({
        success: true,
        data: newComment,
        message: 'Comment created successfully',
      })
    } catch (error: any) {
      console.error('Error creating comment:', error)
      res.status(500).json({
        success: false,
        error: error.message,
      })
    }
  },
)

// PUT /comments/:id - Actualizar comentario (solo creador)
forumRouter.put(
  '/comments/:id',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const { user } = req
      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        })
        return
      }

      const id = parseInt(req.params.id)
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid comment ID',
        })
        return
      }

      const { content } = req.body
      if (!content) {
        res.status(400).json({
          success: false,
          error: 'Content is required',
        })
        return
      }

      const updatedComment = await updateComment(id, content, user.id!)
      res.status(200).json({
        success: true,
        data: updatedComment,
        message: 'Comment updated successfully',
      })
    } catch (error: any) {
      res.status(403).json({
        success: false,
        error: error.message,
      })
    }
  },
)

// DELETE /comments/:id - Eliminar comentario (solo creador)
forumRouter.delete(
  '/comments/:id',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const { user } = req
      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        })
        return
      }

      const id = parseInt(req.params.id)
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid comment ID',
        })
        return
      }

      await deleteComment(id, user.id!)
      res.status(200).json({
        success: true,
        message: 'Comment deleted successfully',
      })
    } catch (error: any) {
      res.status(403).json({
        success: false,
        error: error.message,
      })
    }
  },
)

// ==================== ATTACHMENTS ROUTES ====================

// DELETE /attachments/:id - Eliminar attachment (solo creador)
forumRouter.delete(
  '/attachments/:id',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const { user } = req
      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        })
        return
      }

      const id = parseInt(req.params.id)
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid attachment ID',
        })
        return
      }

      await deleteAttachment(id, user.id!)
      res.status(200).json({
        success: true,
        message: 'Attachment deleted successfully',
      })
    } catch (error: any) {
      res.status(403).json({
        success: false,
        error: error.message,
      })
    }
  },
)

export { forumRouter }
