// routes/googleAuth.router.ts
import { Router, Request, Response } from 'express'
import { getGoogleAuthUrl, getTokensFromCode } from '@/services/googleAuth.service'
import { UserAccount } from '@/models/userAccount.model'
import { authenticateToken } from '@/middlewares/auth.middleware'
import { UserAttributes } from '@/types/user.types'
import { googleAuthMiddleware } from '@/middlewares/googleAuth.middleware'
import { User } from '@/models/user.model'
import env from '@/config/enviroment'
import { getGoogleClassroomService } from '@/services/classroom.service'

const router = Router()
const baseUrl = '/auth/google'

// Redireccionar a Google
router.get(`${baseUrl}`, authenticateToken, (req: Request & { user?: UserAttributes }, res) => {
  const userId = req.user?.id
  if (!userId) {
    res.status(400).send('No se pudo obtener el ID de usuario.')
    return
  }
  console.log(req.headers)
  const state = req.headers['authorization']?.split(' ')[1] || (req as any).accessToken
  console.log('State recibido:', state)
  if (!state) {
    res.status(400).send('No se pudo obtener el token de autorización.')
    return
  }
  const url = getGoogleAuthUrl({ state })
  res.json({ url })
})

// Callback de Google
router.get(
  `${baseUrl}/callback`,
  googleAuthMiddleware,
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    if (!req.user) {
      res.status(400).send('No se pudo obtener el ID de usuario.')
      return
    }
    try {
      // Aquí deberías obtener el user_id desde tu sistema de autenticación
      const userId = req.user.id
      // Verifica si el usuario ya tiene una cuenta de Google
      const existingAccount = await UserAccount.findOne({
        where: {
          user_id: userId,
          platform: 'google',
        },
      })
      const { email, password } = await User.findOne({
        where: {
          id: userId,
        },
      })
      const { code } = req.query
      if (!code || typeof code !== 'string') {
        res.status(400).send('No se proporcionó el código de autorización.')
        return
      }
      // Intercambia el código por un token de acceso
      const tokens = await getTokensFromCode(code)
      if (!tokens || !tokens.access_token) {
        res.status(400).send('No se pudo obtener el token de acceso.')
        return
      }
      if (existingAccount) {
        const expiryDate = new Date(
          tokens.expiry_date ? tokens.expiry_date : Date.now() + 3600 * 1000,
        )

        await UserAccount.update(
          {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expiry_date: expiryDate,
          },
          { where: { user_id: userId, platform: 'google' } },
        )
      } else {
        await UserAccount.create({
          user_id: userId,
          platform: 'google',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          username: email,
          password: password,
          expiry_date: new Date(tokens.expiry_date ? tokens.expiry_date : Date.now() + 3600 * 1000),
        })
      }
      console.log('Redirigiendo a:', `${env.FRONTEND_URL}/profile`)
      res.redirect(`${env.FRONTEND_URL}/profile`)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  },
)

// ==================== CLASSROOM ENDPOINTS ====================

// GET /auth/google/courses - Obtener cursos donde el usuario es maestro
router.get(
  `${baseUrl}/courses`,
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' })
      }

      // Obtener tokens de Google del usuario
      const userAccount = await UserAccount.findOne({
        where: {
          user_id: userId,
          platform: 'google',
        },
      })

      if (!userAccount) {
        res.status(404).json({
          error: 'No se encontró cuenta de Google vinculada',
        })
      }

      const classroom = await getGoogleClassroomService(userAccount.access_token)

      // Obtener cursos donde el usuario es maestro
      const response = await classroom.courses.list({
        teacherId: 'me',
        courseStates: ['ACTIVE'],
        pageSize: 50,
      })

      const courses = response.data.courses || []

      res.json({
        success: true,
        data: {
          courses: courses.map((course: any) => ({
            id: course.id,
            name: course.name,
            section: course.section,
            description: course.description,
            room: course.room,
            ownerId: course.ownerId,
            creationTime: course.creationTime,
            updateTime: course.updateTime,
            enrollmentCode: course.enrollmentCode,
            courseState: course.courseState,
            alternateLink: course.alternateLink,
          })),
          total: courses.length,
        },
      })
    } catch (error: any) {
      console.error('Error obteniendo cursos:', error)
      res.status(500).json({
        error: 'Error al obtener cursos de Google Classroom',
        details: error.message,
      })
    }
  },
)

// GET /auth/google/courses/:courseId - Obtener detalles de un curso específico
router.get(
  `${baseUrl}/courses/:courseId`,
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const userId = req.user?.id
      const { courseId } = req.params

      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' })
      }

      const userAccount = await UserAccount.findOne({
        where: {
          user_id: userId,
          platform: 'google',
        },
      })

      if (!userAccount) {
        res.status(404).json({
          error: 'No se encontró cuenta de Google vinculada',
        })
      }

      const classroom = await getGoogleClassroomService(userAccount.access_token)

      const course = await classroom.courses.get({ id: courseId })

      res.json({
        success: true,
        data: {
          course: course.data,
        },
      })
    } catch (error: any) {
      console.error('Error obteniendo curso:', error)
      res.status(500).json({
        error: 'Error al obtener curso de Google Classroom',
        details: error.message,
      })
    }
  },
)

// POST /auth/google/courses/:courseId/coursework - Crear tarea/publicación
router.post(
  `${baseUrl}/courses/:courseId/coursework`,
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const userId = req.user?.id
      const { courseId } = req.params
      const {
        title,
        description,
        dueDate,
        dueTime,
        maxPoints,
        workType = 'ASSIGNMENT',
        state = 'PUBLISHED',
        materials = [],
      } = req.body

      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' })
      }

      if (!title) {
        res.status(400).json({ error: 'El título es requerido' })
      }

      const userAccount = await UserAccount.findOne({
        where: {
          user_id: userId,
          platform: 'google',
        },
      })

      if (!userAccount) {
        res.status(404).json({
          error: 'No se encontró cuenta de Google vinculada',
        })
      }

      const classroom = await getGoogleClassroomService(userAccount.access_token)

      // Preparar el objeto de tarea
      const courseWork: any = {
        title,
        description,
        workType,
        state,
        materials,
      }

      // Agregar fecha de vencimiento si se proporciona
      if (dueDate) {
        const due = new Date(dueDate)
        courseWork.dueDate = {
          year: due.getFullYear(),
          month: due.getMonth() + 1,
          day: due.getDate(),
        }

        if (dueTime) {
          const [hours, minutes] = dueTime.split(':')
          courseWork.dueTime = {
            hours: parseInt(hours),
            minutes: parseInt(minutes),
          }
        }
      }

      // Agregar puntos máximos si se proporciona
      if (maxPoints !== undefined) {
        courseWork.maxPoints = maxPoints
      }

      const response = await classroom.courses.courseWork.create({
        courseId,
        requestBody: courseWork,
      })

      res.json({
        success: true,
        data: {
          courseWork: response.data,
        },
        message: 'Tarea creada exitosamente',
      })
    } catch (error: any) {
      console.error('Error creando tarea:', error)
      res.status(500).json({
        error: 'Error al crear tarea en Google Classroom',
        details: error.message,
      })
    }
  },
)

// POST /auth/google/courses/:courseId/announcements - Crear anuncio
router.post(
  `${baseUrl}/courses/:courseId/announcements`,
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const userId = req.user?.id
      const { courseId } = req.params
      const { text, materials = [], state = 'PUBLISHED' } = req.body

      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' })
      }

      if (!text) {
        res.status(400).json({ error: 'El texto del anuncio es requerido' })
      }

      const userAccount = await UserAccount.findOne({
        where: {
          user_id: userId,
          platform: 'google',
        },
      })

      if (!userAccount) {
        res.status(404).json({
          error: 'No se encontró cuenta de Google vinculada',
        })
      }

      const classroom = await getGoogleClassroomService(userAccount.access_token)

      const announcement = {
        text,
        materials,
        state,
      }

      const response = await classroom.courses.announcements.create({
        courseId,
        requestBody: announcement,
      })

      res.json({
        success: true,
        data: {
          announcement: response.data,
        },
        message: 'Anuncio creado exitosamente',
      })
    } catch (error: any) {
      console.error('Error creando anuncio:', error)
      res.status(500).json({
        error: 'Error al crear anuncio en Google Classroom',
        details: error.message,
      })
    }
  },
)

// GET /auth/google/courses/:courseId/coursework - Obtener tareas de un curso
router.get(
  `${baseUrl}/courses/:courseId/coursework`,
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const userId = req.user?.id
      const { courseId } = req.params
      const { pageSize = 50, pageToken } = req.query

      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' })
      }

      const userAccount = await UserAccount.findOne({
        where: {
          user_id: userId,
          platform: 'google',
        },
      })

      if (!userAccount) {
        res.status(404).json({
          error: 'No se encontró cuenta de Google vinculada',
        })
      }

      const classroom = await getGoogleClassroomService(userAccount.access_token)

      const response = await classroom.courses.courseWork.list({
        courseId,
        pageSize: Number(pageSize),
        pageToken: pageToken as string,
        courseWorkStates: ['PUBLISHED', 'DRAFT'],
      })

      res.json({
        success: true,
        data: {
          courseWork: response.data.courseWork || [],
          nextPageToken: response.data.nextPageToken,
        },
      })
    } catch (error: any) {
      console.error('Error obteniendo tareas:', error)
      res.status(500).json({
        error: 'Error al obtener tareas de Google Classroom',
        details: error.message,
      })
    }
  },
)

// GET /auth/google/courses/:courseId/announcements - Obtener anuncios de un curso
router.get(
  `${baseUrl}/courses/:courseId/announcements`,
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const userId = req.user?.id
      const { courseId } = req.params
      const { pageSize = 50, pageToken } = req.query

      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' })
      }

      const userAccount = await UserAccount.findOne({
        where: {
          user_id: userId,
          platform: 'google',
        },
      })

      if (!userAccount) {
        res.status(404).json({
          error: 'No se encontró cuenta de Google vinculada',
        })
      }

      const classroom = await getGoogleClassroomService(userAccount.access_token)

      const response = await classroom.courses.announcements.list({
        courseId,
        pageSize: Number(pageSize),
        pageToken: pageToken as string,
        announcementStates: ['PUBLISHED', 'DRAFT'],
      })

      res.json({
        success: true,
        data: {
          announcements: response.data.announcements || [],
          nextPageToken: response.data.nextPageToken,
        },
      })
    } catch (error: any) {
      console.error('Error obteniendo anuncios:', error)
      res.status(500).json({
        error: 'Error al obtener anuncios de Google Classroom',
        details: error.message,
      })
    }
  },
)

// DELETE /auth/google/courses/:courseId/coursework/:courseWorkId - Eliminar tarea
router.delete(
  `${baseUrl}/courses/:courseId/coursework/:courseWorkId`,
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const userId = req.user?.id
      const { courseId, courseWorkId } = req.params

      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' })
      }

      const userAccount = await UserAccount.findOne({
        where: {
          user_id: userId,
          platform: 'google',
        },
      })

      if (!userAccount) {
        res.status(404).json({
          error: 'No se encontró cuenta de Google vinculada',
        })
      }

      const classroom = await getGoogleClassroomService(userAccount.access_token)

      await classroom.courses.courseWork.delete({
        courseId,
        id: courseWorkId,
      })

      res.json({
        success: true,
        message: 'Tarea eliminada exitosamente',
      })
    } catch (error: any) {
      console.error('Error eliminando tarea:', error)
      res.status(500).json({
        error: 'Error al eliminar tarea de Google Classroom',
        details: error.message,
      })
    }
  },
)

export { router as googleAuthRouter }
