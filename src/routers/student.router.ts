import { Router, Request, Response } from 'express'
import { authenticateToken } from '@/middlewares/auth.middleware'
import upload from '@/middlewares/upload.middleware'
import {
  getClassroomAssignments,
  getAssignmentDetails,
  getAssignmentRubric,
  getDriveFileLink,
  turnInAssignment,
  turnInAssignmentWithFile,
  turnInAssignmentWithFileSimple,
  uploadFileToDrive,
} from '@/services/classroom.service'
import { UserAttributes } from '@/types/user.types'
import { UserAccount } from '@/models/userAccount.model'
import { getNewAccessToken } from '@/services/googleAuth.service'
import { getTeamsTasks } from '@/services/teams.service'

const studentRouter = Router()
studentRouter.use(authenticateToken)

// Test endpoint to check server limits
studentRouter.get(
  '/test/limits',
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    res.status(200).json({
      maxJsonSize: '50MB',
      maxUrlEncodedSize: '50MB',
      serverInfo: {
        nodeVersion: process.version,
        platform: process.platform,
        memory: process.memoryUsage(),
      },
    })
  },
)

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

// Submit assignment without file
studentRouter.post(
  '/homework/:courseId/:courseWorkId/submit',
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const { courseId, courseWorkId } = req.params
      const { submissionId, text, metadata } = req.body
      const { user } = req

      console.log('Received text-only submission:', {
        courseId,
        courseWorkId,
        submissionId,
        hasText: !!text,
        metadata,
      })

      if (!user) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      if (!courseId || !courseWorkId) {
        res.status(400).json({ error: 'Course ID and CourseWork ID are required' })
        return
      }

      if (!submissionId) {
        res.status(400).json({ error: 'Submission ID is required' })
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
          console.error('Failed to refresh Google token:', error)
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
        res.status(400).json({ error: 'Failed to submit assignment' })
        return
      }

      res.status(200).json({
        success: true,
        message: 'Assignment submitted successfully',
        submissionId,
        text: text || null,
        metadata,
      })
    } catch (error) {
      console.error('Error submitting assignment:', error)
      res.status(500).json({ error: 'Internal Server Error' })
    }
  },
)

// Submit assignment with file
studentRouter.post(
  '/homework/:courseId/:courseWorkId/submit-file',
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const { courseId, courseWorkId } = req.params
      const { submissionId, text, file, metadata } = req.body
      const { user } = req

      console.log('Received submission request:', {
        courseId,
        courseWorkId,
        submissionId,
        hasFile: !!file,
        hasText: !!text,
        metadata,
      })

      if (!user) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      if (!courseId || !courseWorkId) {
        res.status(400).json({ error: 'Course ID and CourseWork ID are required' })
        return
      }

      if (!submissionId) {
        res.status(400).json({ error: 'Submission ID is required' })
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

      let driveFileId = null

      // If file is provided, upload to Google Drive
      if (file && file.data) {
        try {
          console.log('Processing file upload:', {
            name: file.name,
            mimeType: file.mimeType,
            size: file.size,
            hasData: !!file.data,
          })

          // Validate file size (limit to 25MB before base64 encoding)
          if (file.size && file.size > 25 * 1024 * 1024) {
            res.status(413).json({
              error: 'File too large. Maximum size allowed is 25MB',
              maxSize: '25MB',
              receivedSize: `${Math.round(file.size / 1024 / 1024)}MB`,
            })
            return
          }

          // Convert base64 to buffer
          const base64Data = file.data.replace(/^data:.*?;base64,/, '')

          // Validate base64 data
          if (!base64Data || base64Data.length === 0) {
            res
              .status(400)
              .json({ error: 'Invalid file data. File appears to be empty or corrupted.' })
            return
          }

          const fileBuffer = Buffer.from(base64Data, 'base64')

          console.log('File buffer created:', {
            originalSize: file.size,
            base64Size: base64Data.length,
            bufferSize: fileBuffer.length,
          })

          driveFileId = await uploadFileToDrive(accessToken!, fileBuffer, file.name, file.mimeType)

          if (!driveFileId) {
            res.status(500).json({ error: 'Failed to upload file to Google Drive' })
            return
          }

          console.log('File uploaded to Drive with ID:', driveFileId)
        } catch (fileError) {
          console.error('Error processing file:', fileError)
          res.status(400).json({ error: 'Failed to process file upload' })
          return
        }
      }

      // Submit assignment (with or without file)
      if (driveFileId) {
        try {
          // Try the full attachment method first
          const result = await turnInAssignmentWithFile(
            accessToken!,
            courseId,
            courseWorkId,
            submissionId,
            driveFileId,
          )

          res.status(200).json({
            success: true,
            message: 'Assignment submitted successfully with file attached',
            submissionId,
            driveFileId,
            fileName: file.name,
            text: text || null,
          })
        } catch (attachmentError: any) {
          console.warn(
            'Failed to attach file to submission, trying simple method:',
            attachmentError.message,
          )

          // If attachment fails due to permissions, use simple method
          try {
            const result = await turnInAssignmentWithFileSimple(
              accessToken!,
              courseId,
              courseWorkId,
              submissionId,
              driveFileId,
            )

            // Get file link for user reference
            let fileLink = null
            try {
              fileLink = await getDriveFileLink(accessToken!, driveFileId)
            } catch (linkError) {
              console.warn('Could not get file link:', linkError)
            }

            res.status(200).json({
              success: true,
              message:
                'Assignment submitted - file uploaded to Drive (share link manually with teacher)',
              submissionId,
              driveFileId,
              fileName: file.name,
              text: text || null,
              fileLink: fileLink,
              instructions:
                'The file was uploaded to your Google Drive. You may need to share the link with your teacher manually.',
            })
          } catch (simpleError) {
            console.error('Both attachment methods failed:', simpleError)
            res.status(500).json({ error: 'Failed to submit assignment' })
            return
          }
        }
      } else {
        // Submit without file
        const result = await turnInAssignment(courseId, courseWorkId, submissionId, accessToken!)

        if (!result.success) {
          res.status(400).json({ error: 'Failed to submit assignment' })
          return
        }

        res.status(200).json({
          success: true,
          message: 'Assignment submitted successfully',
          submissionId,
          text: text || null,
        })
      }
    } catch (error) {
      console.error('Error submitting assignment:', error)
      res.status(500).json({ error: 'Internal Server Error' })
    }
  },
)

// Submit assignment with file (alternative multipart endpoint for large files)
studentRouter.post(
  '/homework/:courseId/:courseWorkId/submit-multipart',
  upload.single('file'),
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const { courseId, courseWorkId } = req.params
      const { submissionId, text, metadata } = req.body
      const { user } = req

      console.log('Received multipart submission:', {
        courseId,
        courseWorkId,
        submissionId,
        hasFile: !!req.file,
        hasText: !!text,
        fileSize: req.file?.size,
        metadata: metadata ? JSON.parse(metadata) : null,
      })

      if (!user) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      if (!courseId || !courseWorkId || !submissionId) {
        res.status(400).json({ error: 'Missing required parameters' })
        return
      }

      // Get Google account and handle authentication (same as other endpoints)
      const googleAccount = await UserAccount.findOne({
        where: { user_id: user.id, platform: 'google' },
      })

      if (!googleAccount?.access_token) {
        res.status(401).json({ error: 'No Google account linked' })
        return
      }

      let accessToken = googleAccount.access_token

      if (googleAccount.expiry_date && new Date(googleAccount.expiry_date) < new Date()) {
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

      // Handle file upload if present
      let driveFileId = null
      if (req.file?.buffer) {
        driveFileId = await uploadFileToDrive(
          accessToken!,
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
        )
      }

      // Submit assignment
      if (driveFileId) {
        await turnInAssignmentWithFile(
          accessToken!,
          courseId,
          courseWorkId,
          submissionId,
          driveFileId,
        )
        res.status(200).json({
          success: true,
          message: 'Assignment submitted with file',
          submissionId,
          driveFileId,
          fileName: req.file?.originalname,
          text: text || null,
        })
      } else {
        const result = await turnInAssignment(courseId, courseWorkId, submissionId, accessToken!)
        res.status(200).json({
          success: true,
          message: 'Assignment submitted',
          submissionId,
          text: text || null,
        })
      }
    } catch (error) {
      console.error('Error in multipart submission:', error)
      res.status(500).json({ error: 'Internal Server Error' })
    }
  },
)

// Get assignment details
studentRouter.get(
  '/homework/:courseId/:courseWorkId',
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const { courseId, courseWorkId } = req.params
      const { user } = req

      if (!user) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      if (!courseId || !courseWorkId) {
        res.status(400).json({ error: 'Course ID and CourseWork ID are required' })
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
          console.error('Failed to refresh Google token:', error)
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

      // Get assignment details
      const assignmentDetails = await getAssignmentDetails(accessToken!, courseId, courseWorkId)

      res.status(200).json(assignmentDetails)
    } catch (error) {
      console.error('Error fetching assignment details:', error)
      res.status(500).json({ error: 'Internal Server Error' })
    }
  },
)

// Get assignment rubric
studentRouter.get(
  '/homework/:courseId/:courseWorkId/rubric',
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const { courseId, courseWorkId } = req.params
      const { user } = req

      if (!user) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      if (!courseId || !courseWorkId) {
        res.status(400).json({ error: 'Course ID and CourseWork ID are required' })
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
          console.error('Failed to refresh Google token:', error)
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

      // Get assignment rubric
      const rubric = await getAssignmentRubric(accessToken!, courseId, courseWorkId)

      if (!rubric) {
        res.status(404).json({ error: 'No rubric found for this assignment' })
        return
      }

      res.status(200).json(rubric)
    } catch (error) {
      console.error('Error fetching assignment rubric:', error)
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
