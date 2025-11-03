import { Router, Request, Response } from 'express'
import { authenticateToken } from '@/middlewares/auth.middleware'
import { UserAttributes } from '@/types/user.types'
import { MoodleService } from '@/services/moodle.service'
import { MoodleLoginRequest } from '@/types/moodle.types'
import { getAccounts } from '@/services/user.service'

const moodleRouter = Router()

console.log('📚 Moodle router loaded')

// POST /moodle/login - Login to Moodle and save credentials
moodleRouter.post(
  '/login',
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

      const loginData: MoodleLoginRequest = req.body

      // Validate required fields
      if (!loginData.username || !loginData.password || !loginData.moodle_url) {
        res.status(400).json({
          success: false,
          error: 'Username, password, and moodle_url are required',
        })
        return
      }

      // Login to Moodle
      const moodleResponse = await MoodleService.login(loginData)

      // Save to user_accounts
      await MoodleService.saveMoodleAccount(user.id!, moodleResponse, loginData.moodle_url)

      res.status(200).json({
        success: true,
        message: 'Moodle account connected successfully',
        data: {
          user_id: moodleResponse.user_id,
          username: moodleResponse.username,
          fullname: moodleResponse.fullname,
          email: moodleResponse.email,
        },
      })
    } catch (error: any) {
      console.error('Error connecting Moodle account:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to connect Moodle account',
      })
    }
  },
)

// GET /moodle/courses - Get user's enrolled courses
moodleRouter.get(
  '/courses',
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

      const moodleService = await MoodleService.getServiceForUser(user.id!)

      if (!moodleService) {
        res.status(404).json({
          success: false,
          error: 'Moodle account not connected. Please login first.',
        })
        return
      }

      const courses = await moodleService.getUserCourses()

      res.status(200).json({
        success: true,
        data: courses,
        count: courses.length,
      })
    } catch (error: any) {
      console.error('Error getting Moodle courses:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get courses from Moodle',
      })
    }
  },
)

// GET /moodle/courses/:courseId/assignments - Get assignments for a course
moodleRouter.get(
  '/courses/:courseId/assignments',
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

      const courseId = parseInt(req.params.courseId)
      if (isNaN(courseId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid course ID',
        })
        return
      }

      const moodleService = await MoodleService.getServiceForUser(user.id!)

      if (!moodleService) {
        res.status(404).json({
          success: false,
          error: 'Moodle account not connected. Please login first.',
        })
        return
      }

      const assignments = await moodleService.getCourseAssignments(courseId)

      res.status(200).json({
        success: true,
        data: assignments,
        count: assignments.length,
      })
    } catch (error: any) {
      console.error('Error getting Moodle assignments:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get assignments from Moodle',
      })
    }
  },
)

// GET /moodle/assignments - Get all assignments from all courses
moodleRouter.get(
  '/assignments',
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

      const moodleService = await MoodleService.getServiceForUser(user.id!)

      if (!moodleService) {
        res.status(404).json({
          success: false,
          error: 'Moodle account not connected. Please login first.',
        })
        return
      }

      const assignments = await moodleService.getAllAssignments()

      res.status(200).json({
        success: true,
        data: assignments,
        count: assignments.length,
      })
    } catch (error: any) {
      console.error('Error getting all Moodle assignments:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get assignments from Moodle',
      })
    }
  },
)

// GET /moodle/assignments/:assignmentId/status - Get submission status
moodleRouter.get(
  '/assignments/:assignmentId/status',
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

      const assignmentId = parseInt(req.params.assignmentId)
      if (isNaN(assignmentId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid assignment ID',
        })
        return
      }

      const moodleService = await MoodleService.getServiceForUser(user.id!)

      if (!moodleService) {
        res.status(404).json({
          success: false,
          error: 'Moodle account not connected. Please login first.',
        })
        return
      }

      const status = await moodleService.getSubmissionStatus(assignmentId)

      res.status(200).json({
        success: true,
        data: status,
      })
    } catch (error: any) {
      console.error('Error getting submission status:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get submission status from Moodle',
      })
    }
  },
)

// POST /moodle/assignments/:assignmentId/submit - Submit an assignment
moodleRouter.post(
  '/assignments/:assignmentId/submit',
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

      const assignmentId = parseInt(req.params.assignmentId)
      if (isNaN(assignmentId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid assignment ID',
        })
        return
      }

      const moodleService = await MoodleService.getServiceForUser(user.id!)

      if (!moodleService) {
        res.status(404).json({
          success: false,
          error: 'Moodle account not connected. Please login first.',
        })
        return
      }

      const { onlinetext, files } = req.body

      if (!onlinetext && (!files || files.length === 0)) {
        res.status(400).json({
          success: false,
          error: 'Either onlinetext or files are required for submission',
        })
        return
      }

      const result = await moodleService.submitAssignment(assignmentId, {
        onlinetext,
        files,
      })

      res.status(200).json({
        success: true,
        message: 'Assignment submitted successfully',
        data: result,
      })
    } catch (error: any) {
      console.error('Error submitting assignment:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to submit assignment to Moodle',
      })
    }
  },
)

// POST /moodle/upload - Upload a file to Moodle
moodleRouter.post(
  '/upload',
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

      const moodleService = await MoodleService.getServiceForUser(user.id!)

      if (!moodleService) {
        res.status(404).json({
          success: false,
          error: 'Moodle account not connected. Please login first.',
        })
        return
      }

      const { filename, content, mimeType } = req.body

      if (!filename || !content) {
        res.status(400).json({
          success: false,
          error: 'Filename and content are required',
        })
        return
      }

      const uploadedFile = await moodleService.uploadFile(
        filename,
        content,
        mimeType || 'application/octet-stream',
      )

      res.status(200).json({
        success: true,
        message: 'File uploaded successfully',
        data: uploadedFile,
      })
    } catch (error: any) {
      console.error('Error uploading file to Moodle:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to upload file to Moodle',
      })
    }
  },
)

// GET /moodle/assignments/:assignmentId/grades - Get assignment grades
moodleRouter.get(
  '/assignments/:assignmentId/grades',
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

      const assignmentId = parseInt(req.params.assignmentId)
      if (isNaN(assignmentId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid assignment ID',
        })
        return
      }

      const moodleService = await MoodleService.getServiceForUser(user.id!)

      if (!moodleService) {
        res.status(404).json({
          success: false,
          error: 'Moodle account not connected. Please login first.',
        })
        return
      }

      const grades = await moodleService.getAssignmentGrades(assignmentId)

      res.status(200).json({
        success: true,
        data: grades,
      })
    } catch (error: any) {
      console.error('Error getting assignment grades:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get assignment grades from Moodle',
      })
    }
  },
)

//GET /moodle/accounts - Get connected Moodle accounts for the user
moodleRouter.get(
  '/accounts',
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
      const accounts = await getAccounts(user.id!, 'moodle')
      res.status(200).json({
        success: true,
        data: accounts,
      })
    } catch (error: any) {
      console.error('Error getting Moodle accounts:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get Moodle accounts',
      })
    }
  },
)

// GET /moodle/courses/:courseId/announcements - Get announcements/posts from a Moodle course
moodleRouter.get(
  '/courses/:courseId/announcements',
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

      const courseId = parseInt(req.params.courseId)
      if (isNaN(courseId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid course ID',
        })
        return
      }

      const moodleService = await MoodleService.getServiceForUser(user.id!)

      if (!moodleService) {
        res.status(404).json({
          success: false,
          error: 'Moodle account not connected. Please login first.',
        })
        return
      }

      // Get forum discussions (Moodle's equivalent to announcements)
      const announcements = await moodleService.getCourseAnnouncements(courseId)

      res.status(200).json({
        success: true,
        data: announcements,
        count: announcements.length,
      })
    } catch (error: any) {
      console.error('Error getting Moodle announcements:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get announcements from Moodle',
      })
    }
  },
)

export { moodleRouter }
