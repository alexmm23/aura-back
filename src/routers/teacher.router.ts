import { Router, Request, Response } from 'express'
import { authenticateToken } from '@/middlewares/auth.middleware'
import { authorizeRoute } from '@/middlewares/authorization.middleware'
import { UserAttributes } from '@/types/user.types'
import { UserAccount } from '@/models/userAccount.model'
import { getNewAccessToken } from '@/services/googleAuth.service'
import { MoodleService } from '@/services/moodle.service'
import { listCourses } from '@/services/classroom.service'
import axios from 'axios'

const teacherRouter = Router()

// Aplicar middleware de autenticación y autorización para profesores
teacherRouter.use(authenticateToken)
teacherRouter.use(authorizeRoute([3], ['none', 'premium', 'active'])) // role_id 3 = teacher

// ==================== GOOGLE CLASSROOM ENDPOINTS ====================

// Get Google Classroom courses for teacher
teacherRouter.get(
  '/courses/classroom',
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const { user } = req
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      // Get Google account
      const googleAccount = await UserAccount.findOne({
        where: {
          user_id: user.id,
          platform: 'google',
        },
      })

      if (!googleAccount || !googleAccount.access_token) {
        res.status(401).json({ error: 'No Google account linked' })
        return
      }

      let accessToken = googleAccount.access_token

      // Check if token is expired and refresh if needed
      if (googleAccount.expiry_date && new Date(googleAccount.expiry_date) < new Date()) {
        try {
          accessToken = await getNewAccessToken(user.id)
        } catch (error: any) {
          res.status(401).json({
            error: 'Token expired and refresh failed',
            details: error.message,
          })
          return
        }
      }

      // Get courses
      const courses = await listCourses(accessToken!)
      const formattedCourses = courses.map((course: any) => ({
        ...course,
        source: 'classroom',
      }))

      res.status(200).json(formattedCourses)
    } catch (error: any) {
      console.error('Error fetching Google Classroom courses:', error)
      res.status(500).json({
        error: 'Failed to fetch courses',
        details: error.message,
      })
    }
  },
)

// Get Google Classroom course work (assignments) for a specific course
teacherRouter.get(
  '/courses/classroom/:courseId/coursework',
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const { courseId } = req.params
      const { user } = req

      if (!user) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      if (!courseId) {
        res.status(400).json({ error: 'Course ID is required' })
        return
      }

      // Get Google account
      const googleAccount = await UserAccount.findOne({
        where: {
          user_id: user.id,
          platform: 'google',
        },
      })

      if (!googleAccount || !googleAccount.access_token) {
        res.status(401).json({ error: 'No Google account linked' })
        return
      }

      let accessToken = googleAccount.access_token

      // Check if token is expired and refresh if needed
      if (googleAccount.expiry_date && new Date(googleAccount.expiry_date) < new Date()) {
        try {
          accessToken = await getNewAccessToken(user.id)
        } catch (error: any) {
          res.status(401).json({
            error: 'Token expired and refresh failed',
            details: error.message,
          })
          return
        }
      }

      // Fetch course work from Google Classroom API
      const axios = require('axios')
      const response = await axios.get(
        `https://classroom.googleapis.com/v1/courses/${courseId}/courseWork`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      )

      res.status(200).json(response.data.courseWork || [])
    } catch (error: any) {
      console.error('Error fetching Google Classroom course work:', error)
      res.status(500).json({
        error: 'Failed to fetch course work',
        details: error.response?.data || error.message,
      })
    }
  },
)

// ==================== MOODLE ENDPOINTS ====================

// Get Moodle courses for teacher
teacherRouter.get(
  '/courses/moodle',
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const { user } = req
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      // Get Moodle service for user
      const moodleService = await MoodleService.getServiceForUser(user.id!)
      if (!moodleService) {
        res.status(401).json({ error: 'No Moodle account linked' })
        return
      }

      // Get courses
      const moodleCourses = await moodleService.getCourses()
      const formattedCourses = moodleCourses.map((course: any) => ({
        id: course.id.toString(),
        name: course.fullname || course.displayname,
        section: course.shortname,
        description: course.summary || '',
        room: course.category || '',
        ownerId: course.contacts?.[0]?.id || '',
        creationTime: course.startdate ? new Date(course.startdate * 1000).toISOString() : null,
        updateTime: course.timemodified ? new Date(course.timemodified * 1000).toISOString() : null,
        enrollmentCode: null,
        courseState: course.visible ? 'ACTIVE' : 'ARCHIVED',
        alternateLink:
          course.courseurl || `${moodleService.baseUrl}/course/view.php?id=${course.id}`,
        teacherFolder: null,
        calendarId: null,
        source: 'moodle',
      }))

      res.status(200).json(formattedCourses)
    } catch (error: any) {
      console.error('Error fetching Moodle courses:', error)
      res.status(500).json({
        error: 'Failed to fetch Moodle courses',
        details: error.message,
      })
    }
  },
)

// Get Moodle assignments for a specific course
teacherRouter.get(
  '/courses/moodle/:courseId/assignments',
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const { courseId } = req.params
      const { user } = req

      if (!user) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      if (!courseId) {
        res.status(400).json({ error: 'Course ID is required' })
        return
      }

      // Get Moodle service for user
      const moodleService = await MoodleService.getServiceForUser(user.id!)
      if (!moodleService) {
        res.status(401).json({ error: 'No Moodle account linked' })
        return
      }

      // Get assignments for the course
      const assignments = await moodleService.getCourseAssignments(parseInt(courseId))

      res.status(200).json(assignments)
    } catch (error: any) {
      console.error('Error fetching Moodle assignments:', error)
      res.status(500).json({
        error: 'Failed to fetch assignments',
        details: error.message,
      })
    }
  },
)

// Create a new assignment in Moodle course
teacherRouter.post(
  '/courses/moodle/:courseId/assignments',
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const { courseId } = req.params
      const { nombre, descripcion, duedate } = req.body
      const { user } = req

      console.log('Creating Moodle assignment:', {
        courseId,
        nombre,
        descripcion,
        duedate,
      })

      if (!user) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      if (!courseId) {
        res.status(400).json({ error: 'Course ID is required' })
        return
      }

      if (!nombre) {
        res.status(400).json({ error: 'Assignment name (nombre) is required' })
        return
      }

      // Get Moodle service for user
      const moodleService = await MoodleService.getServiceForUser(user.id!)
      if (!moodleService) {
        res.status(401).json({ error: 'No Moodle account linked' })
        return
      }

      // Prepare parameters for Moodle API
      const params: any = {
        wsfunction: 'local_creartarea_crear_tarea',
        courseid: parseInt(courseId),
        nombre: nombre,
      }

      if (descripcion) {
        params.descripcion = descripcion
      }

      if (duedate) {
        // Convert duedate to Unix timestamp if it's a date string
        const timestamp =
          typeof duedate === 'number' ? duedate : Math.floor(new Date(duedate).getTime() / 1000)
        params.duedate = timestamp
      }

      // Call Moodle API directly using the service's callMoodleAPI method
      // Since callMoodleAPI is private, we'll use axios directly

      const response = await axios.post(
        `${moodleService.baseUrl}/webservice/rest/server.php`,
        new URLSearchParams({
          wstoken: (moodleService as any).token,
          wsfunction: 'local_creartarea_crear_tarea',
          moodlewsrestformat: 'json',
          courseid: courseId,
          nombre: nombre,
          descripcion: descripcion || '',
          duedate: params.duedate?.toString() || '',
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      )

      console.log('Moodle API response:', response.data)

      // Check for errors in response
      if (response.data.exception || response.data.errorcode) {
        throw new Error(response.data.message || response.data.error || 'Moodle API error')
      }

      res.status(201).json({
        success: true,
        message: 'Assignment created successfully in Moodle',
        data: response.data,
        assignid: response.data.assignid || response.data.cmid,
      })
    } catch (error: any) {
      console.error('Error creating Moodle assignment:', error)
      res.status(500).json({
        error: 'Failed to create assignment in Moodle',
        details: error.response?.data || error.message,
      })
    }
  },
)

// ==================== UNIFIED ENDPOINTS ====================

// Get all courses (Google Classroom + Moodle)
teacherRouter.get('/courses', async (req: Request & { user?: UserAttributes }, res: Response) => {
  try {
    const { user } = req
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    let allCourses: any[] = []

    // Get Google Classroom courses
    const googleAccount = await UserAccount.findOne({
      where: {
        user_id: user.id,
        platform: 'google',
      },
    })

    if (googleAccount && googleAccount.access_token) {
      try {
        let accessToken = googleAccount.access_token

        // Check if token is expired and refresh if needed
        if (googleAccount.expiry_date && new Date(googleAccount.expiry_date) < new Date()) {
          try {
            accessToken = await getNewAccessToken(user.id)
          } catch (error: any) {
            console.error('Failed to refresh Google token:', error)
          }
        }

        if (accessToken) {
          const googleCourses = await listCourses(accessToken)
          const formattedGoogleCourses = googleCourses.map((course: any) => ({
            ...course,
            source: 'classroom',
          }))
          allCourses = [...allCourses, ...formattedGoogleCourses]
        }
      } catch (error) {
        console.error('Error fetching Google Classroom courses:', error)
      }
    }

    // Get Moodle courses
    try {
      const moodleService = await MoodleService.getServiceForUser(user.id!)
      if (moodleService) {
        const moodleCourses = await moodleService.getCourses()
        const formattedMoodleCourses = moodleCourses.map((course: any) => ({
          id: course.id.toString(),
          name: course.fullname || course.displayname,
          section: course.shortname,
          description: course.summary || '',
          room: course.category || '',
          ownerId: course.contacts?.[0]?.id || '',
          creationTime: course.startdate ? new Date(course.startdate * 1000).toISOString() : null,
          updateTime: course.timemodified
            ? new Date(course.timemodified * 1000).toISOString()
            : null,
          enrollmentCode: null,
          courseState: course.visible ? 'ACTIVE' : 'ARCHIVED',
          alternateLink:
            course.courseurl || `${moodleService.baseUrl}/course/view.php?id=${course.id}`,
          teacherFolder: null,
          calendarId: null,
          source: 'moodle',
        }))
        allCourses = [...allCourses, ...formattedMoodleCourses]
      }
    } catch (error) {
      console.error('Error fetching Moodle courses:', error)
    }

    res.status(200).json(allCourses)
  } catch (error) {
    console.error('Error listing courses:', error)
    res.status(500).json({ error: 'Internal Server Error' })
  }
})

export { teacherRouter }
