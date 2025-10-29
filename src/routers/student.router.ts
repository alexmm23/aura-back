import { Router, Request, Response } from 'express'
import { authenticateToken } from '@/middlewares/auth.middleware'
import { authorizeRoute } from '@/middlewares/authorization.middleware'
import upload from '@/middlewares/upload.middleware'
import {
  getClassroomAssignments,
  getAssignmentDetails,
  getAssignmentRubric,
  getDriveFileLink,
  testClassroomConnection,
  turnInAssignment,
  turnInAssignmentWithFile,
  turnInAssignmentWithFileSimple,
  uploadFileOnly,
  uploadFileToDrive,
  diagnosePermissions,
  testTurnInProcess,
  attachFileToSubmission,
  listCourses,
} from '@/services/classroom.service'
import { UserAttributes } from '@/types/user.types'
import { UserAccount } from '@/models/userAccount.model'
import { getNewAccessToken } from '@/services/googleAuth.service'
import { MoodleService } from '@/services/moodle.service'
import { UnifiedAssignment } from '@/types/moodle.types'

const studentRouter = Router()

// Aplicar middleware de autenticación y autorización para estudiantes
studentRouter.use(authenticateToken)
studentRouter.use(authorizeRoute([2], ['none', 'premium', 'active'])) // role_id 2 = student

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

// Test Classroom API connection
studentRouter.get(
  '/test/classroom',
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const { user } = req
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

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

      const testResult = await testClassroomConnection(accessToken!)
      res.status(200).json(testResult)
    } catch (error: any) {
      console.error('Error testing classroom connection:', error)
      res.status(500).json({
        error: 'Test failed',
        details: error.message,
      })
    }
  },
)

// ====== ENDPOINTS DE DIAGNÓSTICO AVANZADO ======

// Endpoint para diagnosticar permisos completos
studentRouter.get(
  '/test-permissions',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const { user } = req
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      const googleAccount = await UserAccount.findOne({
        where: { user_id: user.id, platform: 'google' },
      })

      if (!googleAccount || !googleAccount.access_token) {
        res.status(401).json({ error: 'Google account not connected' })
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

      const diagnosisResult = await diagnosePermissions(accessToken!)
      res.status(200).json({
        message: 'Permission diagnosis completed',
        results: diagnosisResult,
        recommendations: generateRecommendations(diagnosisResult),
      })
    } catch (error: any) {
      console.error('Error diagnosing permissions:', error)
      res.status(500).json({
        error: 'Diagnosis failed',
        details: error.message,
      })
    }
  },
)

// Endpoint para testear el proceso completo de turnIn
studentRouter.get(
  '/test-turnin/:courseId/:courseWorkId',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const { user } = req
      const { courseId, courseWorkId } = req.params

      if (!user) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      const googleAccount = await UserAccount.findOne({
        where: { user_id: user.id, platform: 'google' },
      })

      if (!googleAccount || !googleAccount.access_token) {
        res.status(401).json({ error: 'Google account not connected' })
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

      const testResult = await testTurnInProcess(accessToken!, courseId, courseWorkId)
      res.status(200).json({
        message: 'TurnIn process test completed',
        results: testResult,
      })
    } catch (error: any) {
      console.error('Error testing turnIn process:', error)
      res.status(500).json({
        error: 'TurnIn test failed',
        details: error.message,
      })
    }
  },
)

// Endpoint para solo adjuntar archivo (sin turnIn)
studentRouter.post(
  '/homework/:courseId/:courseWorkId/attach-file',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const { user } = req
      const { courseId, courseWorkId } = req.params
      const { submissionId, file } = req.body

      if (!user) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      if (!file || !file.data) {
        res.status(400).json({ error: 'No file provided' })
        return
      }

      const googleAccount = await UserAccount.findOne({
        where: { user_id: user.id, platform: 'google' },
      })

      if (!googleAccount || !googleAccount.access_token) {
        res.status(401).json({ error: 'Google account not connected' })
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

      // Convert base64 to buffer
      const base64Data = file.data.replace(/^data:.*?;base64,/, '')
      const fileBuffer = Buffer.from(base64Data, 'base64')

      // Upload file to Drive
      const driveFileId = await uploadFileToDrive(
        accessToken!,
        fileBuffer,
        file.name,
        file.mimeType,
      )

      // Use upload-only method (evita problemas de permisos de modifyAttachments)
      const result = await uploadFileOnly(
        accessToken!,
        courseId,
        courseWorkId,
        submissionId,
        driveFileId!,
      )

      res.status(200).json({
        ...result,
        note: 'File uploaded successfully - manual attachment required due to API permissions',
      })
    } catch (error: any) {
      console.error('Error attaching file:', error)
      res.status(500).json({
        error: 'Failed to attach file',
        details: error.message,
      })
    }
  },
)

// Helper function para generar recomendaciones
function generateRecommendations(diagnosis: any) {
  const recommendations = []

  if (!diagnosis.userProfile?.success) {
    recommendations.push('❌ Cannot access user profile - Check basic Classroom API access')
  }

  if (!diagnosis.listCourses?.success) {
    recommendations.push('❌ Cannot list courses - Verify Classroom API is enabled')
  }

  if (!diagnosis.driveAccess?.success) {
    recommendations.push('❌ Cannot access Drive - Check Drive API permissions')
  }

  if (!diagnosis.courseWorkAccess?.success) {
    recommendations.push('❌ Cannot access courseWork - May need teacher permissions')
  }

  if (!diagnosis.submissionsAccess?.success) {
    recommendations.push('❌ Cannot access submissions - Student submission permissions missing')
  }

  if (diagnosis.errors.length === 0) {
    recommendations.push('✅ All basic permissions working correctly')
  }

  return recommendations
}

studentRouter.get('/homework', async (req: Request & { user?: UserAttributes }, res: Response) => {
  try {
    const { user } = req
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    let allHomework: UnifiedAssignment[] = []

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
          // console.log('Attempting to fetch classroom assignments with access token...')
          const classroomHomework = await getClassroomAssignments(accessToken)
          // console.log(`Successfully fetched ${classroomHomework.length} assignments from Classroom`)

          // Transform to unified format
          const unifiedClassroom: UnifiedAssignment[] = classroomHomework.map((hw: any) => {
            let dueDate = null
            if (hw.dueDate) {
              try {
                const parsedDate = new Date(hw.dueDate.year, hw.dueDate.month - 1, hw.dueDate.day)
                if (!isNaN(parsedDate.getTime())) {
                  dueDate = parsedDate.toISOString()
                }
              } catch (error) {
                console.warn(`Invalid date format for assignment ${hw.title}: ${hw.dueDate}`)
              }
            }

            return {
              id: `classroom_${hw.courseId}_${hw.courseWorkId}_${hw.submissionId || 'no-submission'}`,
              title: hw.title || 'Sin título',
              description: hw.description || '',
              dueDate,
              dueTime: hw.dueTime || null,
              maxPoints: hw.maxPoints || null,
              courseName: hw.courseName || 'Sin nombre',
              courseId: hw.courseId,
              status: hw.state || 'assigned',
              source: 'classroom' as const,
              submissionStatus: hw.submissionState || 'NEW',
              link: hw.alternateLink,
              alternateLink: hw.alternateLink,
              materials: hw.materials || [],
            }
          })

          allHomework = [...allHomework, ...unifiedClassroom]
        } catch (error: any) {
          console.error('Error fetching Google Classroom assignments - Full details:', {
            message: error.message,
            code: error.code,
            status: error.status,
            stack: error.stack,
          })
          // Don't throw error, continue without Google assignments
        }
      } else {
        console.warn('No valid access token available for Google Classroom')
      }
    }

    // Get Moodle assignments
    try {
      const moodleService = await MoodleService.getServiceForUser(user.id!)
      // console.log('Moodle service for user:', moodleService ? 'Found' : 'Not found')

      if (moodleService) {
        // console.log('Attempting to fetch Moodle assignments...')
        const moodleAssignments = await moodleService.getAllAssignments()
        // console.log(`Successfully fetched ${moodleAssignments.length} assignments from Moodle`)

        // Transform to unified format
        const unifiedMoodle: UnifiedAssignment[] = moodleAssignments.map((assignment: any) => {
          const now = Math.floor(Date.now() / 1000)
          let status: 'assigned' | 'submitted' | 'graded' | 'late' | 'missing' = 'assigned'

          // Determine status based on submission and dates
          if (assignment.submission) {
            if (assignment.submission.status === 'submitted') {
              status = 'submitted'
            } else if (assignment.submission.status === 'graded') {
              status = 'graded'
            }
          } else if (assignment.duedate && assignment.duedate < now) {
            status = 'late'
          }

          return {
            id: `moodle_${assignment.course}_${assignment.id}`,
            title: assignment.name,
            description: assignment.intro || '',
            dueDate: assignment.duedate ? new Date(assignment.duedate * 1000).toISOString() : null,
            dueTime: assignment.duedate
              ? new Date(assignment.duedate * 1000).toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : null,
            maxPoints: assignment.grade || null,
            courseName: assignment.courseName || assignment.courseShortName || 'Sin nombre',
            courseId: assignment.course.toString(),
            status,
            source: 'moodle' as const,
            submissionStatus: assignment.submission?.status || 'new',
            grade: assignment.submission?.grade || null,
            allowSubmissionsFromDate: assignment.allowsubmissionsfromdate,
            cutoffDate: assignment.cutoffdate,
          }
        })

        allHomework = [...allHomework, ...unifiedMoodle]
      } else {
        console.log('No Moodle account connected for this user')
      }
    } catch (error: any) {
      console.error('Error fetching Moodle assignments:', error.message)
      // Don't throw error, continue without Moodle assignments
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
            console.error(
              'Both attachment and simple methods failed, trying upload-only:',
              simpleError,
            )

            // Last resort: just upload file and make it shareable
            try {
              const uploadResult = await uploadFileOnly(
                accessToken!,
                courseId,
                courseWorkId,
                submissionId,
                driveFileId,
              )

              res.status(200).json({
                success: true,
                message: 'File uploaded successfully - manual submission required',
                submissionId,
                driveFileId,
                fileName: file.name,
                text: text || null,
                fileInfo: uploadResult.fileInfo,
                instructions: uploadResult.instructions,
                note: 'Due to API restrictions, please submit this assignment manually in Google Classroom using the provided link.',
              })
            } catch (uploadError) {
              console.error('All methods failed:', uploadError)
              res.status(500).json({
                error: 'Could not process assignment submission',
                details:
                  'Google Classroom API permissions are insufficient. Please check Google Cloud Console configuration.',
                driveFileId: driveFileId,
                message: 'File was uploaded to Drive but could not be submitted to Classroom',
              })
            }
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

// Upload file only (no submission) - for when API permissions are limited
studentRouter.post(
  '/homework/:courseId/:courseWorkId/upload-only',
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const { courseId, courseWorkId } = req.params
      const { submissionId, text, file, metadata } = req.body
      const { user } = req

      console.log('Upload-only request:', { courseId, courseWorkId, submissionId, hasFile: !!file })

      if (!user) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      if (!courseId || !courseWorkId || !submissionId) {
        res.status(400).json({ error: 'Missing required parameters' })
        return
      }

      if (!file || !file.data) {
        res.status(400).json({ error: 'File is required for this endpoint' })
        return
      }

      // Get Google account
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

      // Upload file to Drive
      const base64Data = file.data.replace(/^data:.*?;base64,/, '')
      const fileBuffer = Buffer.from(base64Data, 'base64')

      const driveFileId = await uploadFileToDrive(
        accessToken!,
        fileBuffer,
        file.name,
        file.mimeType,
      )

      if (!driveFileId) {
        res.status(500).json({ error: 'Failed to upload file to Google Drive' })
        return
      }

      // Use upload-only method
      const result = await uploadFileOnly(
        accessToken!,
        courseId,
        courseWorkId,
        submissionId,
        driveFileId,
      )

      res.status(200).json({
        success: true,
        message: 'File uploaded and made shareable',
        submissionId,
        driveFileId,
        fileName: file.name,
        text: text || null,
        fileInfo: result.fileInfo,
        instructions: result.instructions,
      })
    } catch (error: any) {
      console.error('Error in upload-only endpoint:', error)
      res.status(500).json({ error: 'Internal Server Error', details: error.message })
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
// Get Moodle assignment details
studentRouter.get(
  '/homework/moodle/:courseId/:assignmentId',
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const { courseId, assignmentId } = req.params
      const { user } = req

      if (!user) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      if (!courseId || !assignmentId) {
        res.status(400).json({ error: 'Course ID and Assignment ID are required' })
        return
      }

      // Get Moodle service for user
      const moodleService = await MoodleService.getServiceForUser(user.id!)
      if (!moodleService) {
        res.status(401).json({ error: 'No Moodle account linked' })
        return
      }

      // Get all assignments and find the requested one
      const allAssignments = await moodleService.getAllAssignments()
      console.log(allAssignments)
      const assignment = allAssignments.find(
        (a: any) =>
          a.course?.toString() === courseId.toString() &&
          a.id?.toString() === assignmentId.toString(),
      )

      if (!assignment) {
        res.status(404).json({ error: 'Assignment not found in Moodle' })
        return
      }

      // Adapt response to unified format
      const now = Math.floor(Date.now() / 1000)
      let status: 'assigned' | 'submitted' | 'graded' | 'late' | 'missing' = 'assigned'
      if (assignment.submission) {
        if (assignment.submission.status === 'submitted') {
          status = 'submitted'
        }
      } else if (assignment.duedate && assignment.duedate < now) {
        status = 'late'
      }

      const assignmentDetails = {
        id: `moodle_${assignment.course}_${assignment.id}`,
        title: assignment.name,
        description: assignment.intro || '',
        dueDate: assignment.duedate ? new Date(assignment.duedate * 1000).toISOString() : null,
        dueTime: assignment.duedate
          ? new Date(assignment.duedate * 1000).toLocaleTimeString('es-ES', {
              hour: '2-digit',
              minute: '2-digit',
            })
          : null,
        maxPoints: assignment.grade || null,
        courseName: assignment.courseName || assignment.courseShortname || 'Sin nombre',
        courseId: assignment.course.toString(),
        status,
        source: 'moodle',
        submissionStatus: assignment.submission?.status || 'new',
        allowSubmissionsFromDate: assignment.allowsubmissionsfromdate,
        cutoffDate: assignment.cutoffdate,
      }

      res.status(200).json(assignmentDetails)
    } catch (error) {
      console.error('Error fetching Moodle assignment details:', error)
      res.status(500).json({ error: 'Internal Server Error' })
    }
  },
)

// Submit Moodle assignment (with or without file)
studentRouter.post(
  '/homework/moodle/:courseId/:assignmentId/submit',
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    try {
      const { courseId, assignmentId } = req.params
      const { text, file } = req.body
      const { user } = req

      console.log('Received Moodle submission request:', {
        courseId,
        assignmentId,
        hasFile: !!file,
        hasText: !!text,
      })

      if (!user) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      if (!courseId || !assignmentId) {
        res.status(400).json({ error: 'Course ID and Assignment ID are required' })
        return
      }

      // Get Moodle service for user
      const moodleService = await MoodleService.getServiceForUser(user.id!)
      if (!moodleService) {
        res.status(401).json({ error: 'No Moodle account linked' })
        return
      }

      // Prepare submission data
      const submissionData: {
        onlinetext?: string
        files?: Array<{ filename: string; content: string; mimeType: string }>
      } = {}

      // Add text if provided
      if (text) {
        submissionData.onlinetext = text
      }

      // Add file if provided
      if (file && file.data) {
        console.log('Processing file for Moodle:', {
          name: file.name,
          mimeType: file.mimeType,
          size: file.size,
        })

        // Validate file size (limit to 25MB)
        if (file.size && file.size > 25 * 1024 * 1024) {
          res.status(413).json({
            error: 'File too large. Maximum size allowed is 25MB',
            maxSize: '25MB',
            receivedSize: `${Math.round(file.size / 1024 / 1024)}MB`,
          })
          return
        }

        submissionData.files = [
          {
            filename: file.name,
            content: file.data, // Base64 string
            mimeType: file.mimeType,
          },
        ]
      }

      // Submit to Moodle
      const result = await moodleService.submitAssignment(parseInt(assignmentId), submissionData)

      res.status(200).json({
        success: true,
        message: 'Moodle assignment submitted successfully',
        assignmentId,
        courseId,
        text: text || null,
        fileName: file?.name || null,
        itemid: result.itemid,
      })
    } catch (error: any) {
      console.error('Error submitting Moodle assignment:', error)
      res.status(500).json({
        error: 'Failed to submit Moodle assignment',
        details: error.message,
      })
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
studentRouter.get(
  '/courses/list',
  async (req: Request & { user?: UserAttributes }, res: Response) => {
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
  },
)

export { studentRouter }
