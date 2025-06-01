import { Router, Request, Response } from 'express'
import { authenticateToken } from '@/middlewares/auth.middleware'
import upload from '@/middlewares/upload.middleware'
import {
  getClassroomAssignments,
  turnInAssignment,
  turnInAssignmentWithFile,
  uploadFileToDrive,
} from '@/services/classroom.service'
import { UserAttributes } from '@/types/user.types'
import { UserAccount } from '@/models/userAccount.model'
import { getNewAccessToken } from '@/services/googleAuth.service'
import { getTeamsTasks } from '@/services/teams.service'

const studentRouter = Router()
studentRouter.use(authenticateToken)

studentRouter.get('/homework', async (req: Request & { user?: UserAttributes }, res: Response) => {
  try {
    const { user } = req
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    let allHomework: any[] = []

    // Get Google Classroom assignments
    const googleAccount = await UserAccount.findOne({
      where: {
        user_id: user.id,
        platform: 'google',
      },
    })

    if (googleAccount) {
      let accessToken = googleAccount.access_token

      // Si el token está expirado, intenta renovarlo
      if (googleAccount.expiry_date && new Date(googleAccount.expiry_date) < new Date()) {
        try {
          accessToken = await getNewAccessToken(user.id)
        } catch (error: any) {
          console.error('Failed to refresh Google token:', error)
          // Don't throw error, just skip Google homework
        }
      }

      if (accessToken) {
        try {
          const classroomHomework = await getClassroomAssignments(accessToken)
          allHomework = [...allHomework, ...classroomHomework]
        } catch (error) {
          console.error('Error fetching Google Classroom assignments:', error)
        }
      }
    }

    // // Get Microsoft Teams tasks
    // const microsoftAccount = await UserAccount.findOne({
    //   where: {
    //     user_id: user.id,
    //     platform: 'microsoft',
    //   },
    // })

    // if (microsoftAccount && microsoftAccount.access_token) {
    //   try {
    //     const teamsTasks = await getTeamsTasks(microsoftAccount.access_token)
    //     // Transform Teams tasks to match homework format
    //     const formattedTasks = teamsTasks.map((task: any) => ({
    //       id: task.id,
    //       title: task.title,
    //       courseId: task.planId,
    //       courseWorkId: task.id,
    //       submissionId: null,
    //       courseName: 'Microsoft Teams',
    //       dueDate: task.dueDateTime ? new Date(task.dueDateTime) : null,
    //       platform: 'teams',
    //       description: task.title,
    //     }))
    //     allHomework = [...allHomework, ...formattedTasks]
    //   } catch (error) {
    //     console.error('Error fetching Microsoft Teams tasks:', error)
    //   }
    // }

    // If no accounts are linked
    // if (!googleAccount && !microsoftAccount) {
    //   res.status(401).json({
    //     error: 'No accounts linked',
    //     needsAuth: true,
    //     availableAuth: [
    //       { platform: 'google', authUrl: '/api/auth/google' },
    //       { platform: 'microsoft', authUrl: '/api/auth/microsoft' },
    //     ],
    //   })
    //   return
    // }

    res.status(200).json(allHomework)
  } catch (error) {
    console.error('Error fetching homework:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Turn in assignment without file
studentRouter.post(
  '/homework/classroom/turnin',
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const { submissionId, courseId, courseWorkId } = req.body

      if (!submissionId || !courseId || !courseWorkId) {
        res.status(400).json({ error: 'Submission ID, Course ID and CourseWork ID are required' })
        return
      }

      const { user } = req
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      const userAccount = await UserAccount.findOne({
        where: {
          user_id: user.id,
          platform: 'google',
        },
      })

      if (!userAccount || !userAccount.access_token) {
        res.status(401).json({ error: 'No Google account linked' })
        return
      }

      let accessToken = userAccount.access_token

      // Check if token is expired and refresh if needed
      if (userAccount.expiry_date && new Date(userAccount.expiry_date) < new Date()) {
        try {
          accessToken = await getNewAccessToken(user.id)
        } catch (error: any) {
          if (error.message.includes('re-authorize')) {
            res.status(401).json({
              error: 'Google authorization expired. Please re-authenticate.',
              needsAuth: true,
              authUrl: '/api/auth/google',
            })
            return
          }
          throw error
        }
      }

      const result = await turnInAssignment(courseId, courseWorkId, submissionId, accessToken!)

      if (!result.success) {
        res.status(404).json({ error: 'Failed to turn in assignment' })
        return
      }

      res.status(200).json({ success: true, message: 'Assignment turned in successfully' })
    } catch (error) {
      console.error('Error turning in assignment:', error)
      res.status(500).json({ error: 'Internal Server Error' })
    }
  },
)

// Turn in assignment with file
studentRouter.post(
  '/homework/classroom/turnin-with-file',
  upload.single('file'),
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const { submissionId, courseId, courseWorkId } = req.body

      if (!submissionId || !courseId || !courseWorkId) {
        res.status(400).json({ error: 'Submission ID, Course ID and CourseWork ID are required' })
        return
      }

      if (!req.file) {
        res.status(400).json({ error: 'File is required for this endpoint' })
        return
      }

      const { user } = req
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      const userAccount = await UserAccount.findOne({
        where: {
          user_id: user.id,
          platform: 'google',
        },
      })

      if (!userAccount || !userAccount.access_token) {
        res.status(401).json({ error: 'No Google account linked' })
        return
      }

      let accessToken = userAccount.access_token

      // Check if token is expired and refresh if needed
      if (userAccount.expiry_date && new Date(userAccount.expiry_date) < new Date()) {
        try {
          accessToken = await getNewAccessToken(user.id)
        } catch (error: any) {
          if (error.message.includes('re-authorize')) {
            res.status(401).json({
              error: 'Google authorization expired. Please re-authenticate.',
              needsAuth: true,
              authUrl: '/api/auth/google',
            })
            return
          }
          throw error
        }
      }

      // Upload file to Google Drive first
      const driveFileId = await uploadFileToDrive(
        accessToken!,
        req.file.buffer,
        req.file.originalname,
      )

      if (!driveFileId) {
        res.status(500).json({ error: 'Failed to upload file to Google Drive' })
        return
      }

      // Then turn in assignment with the file
      await turnInAssignmentWithFile(
        accessToken!,
        courseId,
        courseWorkId,
        submissionId,
        driveFileId,
      )

      res.status(200).json({
        success: true,
        message: 'Assignment turned in successfully with file',
        driveFileId,
      })
    } catch (error) {
      console.error('Error turning in assignment with file:', error)
      res.status(500).json({ error: 'Internal Server Error' })
    }
  },
)

studentRouter.post('/homework', async (req, res) => {
  try {
    const { title, dueDate } = req.body
    // Simulate saving homework data
    const newHomework = {
      id: Math.floor(Math.random() * 1000), // Simulate an ID
      title,
      dueDate,
    }
    res.status(201).json(newHomework)
  } catch (error) {
    console.error('Error creating homework:', error)
    res.status(500).json({ error: 'Internal Server Error' })
  }
})

export { studentRouter }
