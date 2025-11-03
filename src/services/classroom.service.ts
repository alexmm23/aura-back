import { google } from 'googleapis'
import { createOAuth2Client } from './googleAuth.service.js'
import { Readable } from 'stream'

export const getGoogleClassroomService = (accessToken: string) => {
  const oauth2Client = createOAuth2Client(accessToken)
  return google.classroom({ version: 'v1', auth: oauth2Client })
}

export const testClassroomConnection = async (accessToken: string) => {
  try {
    console.log('Testing Classroom API connection...')

    if (!accessToken) {
      throw new Error('No access token provided')
    }

    const oauth2Client = createOAuth2Client(accessToken)
    const classroom = google.classroom({ version: 'v1', auth: oauth2Client })

    // Test basic connection
    const response = await classroom.courses.list({
      pageSize: 1,
      courseStates: ['ACTIVE'],
    })

    console.log('Classroom API test successful:', {
      coursesFound: response.data.courses?.length || 0,
      status: 'connected',
    })

    return {
      success: true,
      coursesFound: response.data.courses?.length || 0,
      courses:
        response.data.courses?.map((course) => ({
          id: course.id,
          name: course.name,
          section: course.section,
        })) || [],
    }
  } catch (error: any) {
    console.error('Classroom API test failed:', {
      message: error.message,
      code: error.code,
      status: error.status,
    })

    return {
      success: false,
      error: error.message,
      code: error.code,
      status: error.status,
    }
  }
}

export const getClassroomAssignments = async (accessToken: string) => {
  // console.log('Creating OAuth2 client for Classroom API...')

  if (!accessToken) {
    throw new Error('Access token is required')
  }

  const oauth2Client = createOAuth2Client(accessToken)
  const classroom = google.classroom({ version: 'v1', auth: oauth2Client })

  try {
    console.log('Starting to fetch classroom assignments...')

    const response = await classroom.courses.list({
      pageSize: 10,
      courseStates: ['ACTIVE'],
    })

    const courses = response.data.courses || []
    // console.log(`Found ${courses.length} active courses`)

    if (courses.length === 0) {
      // console.log('No active courses found')
      return []
    }

    // Parallelize fetching courseWork for all courses
    const courseWorkPromises = courses.map(async (course) => {
      const { id: courseId, name } = course
      if (!courseId || !name) {
        console.warn('Skipping course with missing ID or name:', { courseId, name })
        return []
      }

      // console.log(`Fetching courseWork for course: ${name} (${courseId})`)

      try {
        const courseWorkResponse = await classroom.courses.courseWork.list({
          courseId,
          pageSize: 10,
        })
        const courseWork = courseWorkResponse.data.courseWork || []
        // console.log(`Found ${courseWork.length} courseWork items for course ${name}`)

        // Parallelize fetching submissions for all courseWork
        const assignments = await Promise.all(
          courseWork.map(async (work) => {
            try {
              const submissionsResponse =
                await classroom.courses.courseWork.studentSubmissions.list({
                  courseId,
                  courseWorkId: work.id!,
                  userId: 'me',
                })
              const submissions = submissionsResponse.data.studentSubmissions || []
              // console.log(
              //   'Submissions for courseWork:',
              //   work.id,
              //   submissions.map((s) => ({ id: s.id, state: s.state })),
              // )

              // Find the submission that is not turned in (CREATED or NEW state)
              const pendingSubmission = submissions.find(
                (submission) => submission.state === 'CREATED' || submission.state === 'NEW',
              )

              if (pendingSubmission) {
                return {
                  id: work.id,
                  title: work.title,
                  courseId,
                  courseWorkId: work.id,
                  submissionId: pendingSubmission.id || null,
                  courseName: name,
                  dueDate: work.dueDate,
                  platform: 'classroom',
                }
              }
              return null
            } catch (submissionError: any) {
              console.error(
                `Error fetching submissions for courseWork ${work.id}:`,
                submissionError.message,
              )
              return null
            }
          }),
        )
        // Sort assignments by due date (most recent first) and take only first 5
        const filteredAssignments = assignments.filter(Boolean)
        const sortedAssignments = filteredAssignments
          .sort((a, b) => {
            // Type guard: ensure both a and b are not null
            if (!a || !b) return 0
            if (!a.dueDate && !b.dueDate) return 0
            if (!a.dueDate) return 1
            if (!b.dueDate) return -1

            // Ensure all date components exist before creating Date objects
            if (!a.dueDate.year || !a.dueDate.month || !a.dueDate.day) return 1
            if (!b.dueDate.year || !b.dueDate.month || !b.dueDate.day) return -1

            const dateA = new Date(a.dueDate.year, a.dueDate.month - 1, a.dueDate.day)
            const dateB = new Date(b.dueDate.year, b.dueDate.month - 1, b.dueDate.day)

            return dateB.getTime() - dateA.getTime()
          })
          .slice(0, 5)

        // console.log(`Returning top 5 assignments (sorted by due date) for course ${name}`)
        return sortedAssignments
      } catch (courseWorkError: any) {
        console.error(`Error fetching courseWork for course ${courseId}:`, courseWorkError.message)
        return []
      }
    })

    const results = await Promise.all(courseWorkPromises)
    // Flatten the array and remove nulls
    return results.flat()
  } catch (error: any) {
    console.error('Error fetching assignments - Full error:', {
      message: error.message,
      code: error.code,
      status: error.status,
      errors: error.errors,
      stack: error.stack,
    })

    // Log the original error details for debugging
    if (error.response) {
      console.error('Response data:', error.response.data)
      console.error('Response status:', error.response.status)
      console.error('Response headers:', error.response.headers)
    }

    throw new Error(`Failed to fetch assignments: ${error.message}`)
  }
}

export async function turnInAssignment(
  courseId: string,
  courseWorkId: string,
  submissionId: string,
  accessToken: string,
) {
  const oauth2Client = createOAuth2Client(accessToken)
  const classroom = google.classroom({ version: 'v1', auth: oauth2Client })
  try {
    await classroom.courses.courseWork.studentSubmissions.turnIn({
      courseId,
      courseWorkId,
      id: submissionId,
    })
    return {
      success: true,
    }
  } catch (error) {
    console.error('Error turning in assignment:', error)
    throw new Error('Failed to turn in assignment')
  }
}

export const uploadFileToDrive = async (
  accessToken: string,
  fileBuffer: Buffer,
  fileName: string,
  mimeType?: string,
) => {
  const oauth2Client = createOAuth2Client(accessToken)
  const drive = google.drive({ version: 'v3', auth: oauth2Client })

  const fileMetadata = {
    name: fileName,
  }

  const media = {
    mimeType: mimeType || 'application/octet-stream',
    body: Readable.from(fileBuffer), // Convierte Buffer a stream directamente
  }

  console.log('Uploading file to Drive:', { fileName, mimeType, bufferSize: fileBuffer.length })

  try {
    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
    })

    console.log('File uploaded successfully to Drive with ID:', file.data.id)
    return file.data.id
  } catch (error) {
    console.error('Error uploading file to Drive:', error)
    throw new Error('Failed to upload file to Google Drive')
  }
}
export const getAssignmentDetails = async (
  accessToken: string,
  courseId: string,
  courseWorkId: string,
) => {
  const oauth2Client = createOAuth2Client(accessToken)
  const classroom = google.classroom({ version: 'v1', auth: oauth2Client })

  try {
    // Get the courseWork details
    const courseWorkResponse = await classroom.courses.courseWork.get({
      courseId,
      id: courseWorkId,
    })

    const courseWork = courseWorkResponse.data

    // Get the course details
    const courseResponse = await classroom.courses.get({
      id: courseId,
    })

    const course = courseResponse.data

    // Get student submissions for this assignment
    const submissionsResponse = await classroom.courses.courseWork.studentSubmissions.list({
      courseId,
      courseWorkId,
      userId: 'me',
    })

    const submissions = submissionsResponse.data.studentSubmissions || []

    // Get rubric associated with this courseWork
    let rubric = null
    try {
      const rubricsResponse = await classroom.courses.courseWork.rubrics.list({
        courseId,
        courseWorkId,
      })

      if (rubricsResponse.data.rubrics && rubricsResponse.data.rubrics.length > 0) {
        rubric = rubricsResponse.data.rubrics[0] // Get the first (usually only) rubric
      }
    } catch (rubricError) {
      console.error('Error fetching rubric:', rubricError)
      // Don't throw error, just set rubric to null
    }

    return {
      id: courseWork.id,
      title: courseWork.title,
      description: courseWork.description,
      courseId,
      courseWorkId,
      courseName: course.name,
      courseSection: course.section,
      dueDate: courseWork.dueDate,
      dueTime: courseWork.dueTime,
      maxPoints: courseWork.maxPoints,
      workType: courseWork.workType,
      materials: courseWork.materials,
      state: courseWork.state,
      alternateLink: courseWork.alternateLink,
      creationTime: courseWork.creationTime,
      updateTime: courseWork.updateTime,
      submissions: submissions.map((submission) => ({
        id: submission.id,
        userId: submission.userId,
        courseWorkId: submission.courseWorkId,
        state: submission.state,
        alternateLink: submission.alternateLink,
        assignmentSubmission: submission.assignmentSubmission,
        shortAnswerSubmission: submission.shortAnswerSubmission,
        multipleChoiceSubmission: submission.multipleChoiceSubmission,
        creationTime: submission.creationTime,
        updateTime: submission.updateTime,
        assignedGrade: submission.assignedGrade,
        draftGrade: submission.draftGrade,
      })),
      rubric: rubric
        ? {
            id: rubric.id,
            sourceSpreadsheetId: rubric.sourceSpreadsheetId,
            criteria:
              rubric.criteria?.map((criterion) => ({
                id: criterion.id,
                title: criterion.title,
                description: criterion.description,
                levels:
                  criterion.levels?.map((level) => ({
                    id: level.id,
                    title: level.title,
                    description: level.description,
                    points: level.points,
                  })) || [],
              })) || [],
          }
        : null,
      platform: 'classroom',
    }
  } catch (error) {
    console.error('Error fetching assignment details:', error)
    throw new Error('Failed to fetch assignment details')
  }
}

export const getAssignmentRubric = async (
  accessToken: string,
  courseId: string,
  courseWorkId: string,
) => {
  const oauth2Client = createOAuth2Client(accessToken)
  const classroom = google.classroom({ version: 'v1', auth: oauth2Client })

  try {
    const rubricsResponse = await classroom.courses.courseWork.rubrics.list({
      courseId,
      courseWorkId,
    })

    const rubrics = rubricsResponse.data.rubrics || []

    if (rubrics.length === 0) {
      return null
    }

    const rubric = rubrics[0] // Get the first (usually only) rubric

    return {
      id: rubric.id,
      sourceSpreadsheetId: rubric.sourceSpreadsheetId,
      criteria:
        rubric.criteria?.map((criterion) => ({
          id: criterion.id,
          title: criterion.title,
          description: criterion.description,
          levels:
            criterion.levels?.map((level) => ({
              id: level.id,
              title: level.title,
              description: level.description,
              points: level.points,
            })) || [],
        })) || [],
    }
  } catch (error) {
    console.error('Error fetching rubric:', error)
    throw new Error('Failed to fetch assignment rubric')
  }
}

export const uploadFileOnly = async (
  accessToken: string,
  courseId: string,
  courseWorkId: string,
  submissionId: string,
  driveFileId: string,
) => {
  const oauth2Client = createOAuth2Client(accessToken)
  const drive = google.drive({ version: 'v3', auth: oauth2Client })

  try {
    console.log('Upload-only method: Just uploading file to Drive and making it shareable')

    // 1. Hacer el archivo público/shareable
    await drive.permissions.create({
      fileId: driveFileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    })

    // 2. Obtener el link del archivo
    const file = await drive.files.get({
      fileId: driveFileId,
      fields: 'id,name,webViewLink,webContentLink,mimeType,size',
    })

    return {
      success: true,
      message: 'File uploaded and made shareable. Manual submission required.',
      driveFileId,
      fileInfo: {
        id: file.data.id,
        name: file.data.name,
        viewLink: file.data.webViewLink,
        downloadLink: file.data.webContentLink,
        mimeType: file.data.mimeType,
        size: file.data.size,
      },
      instructions: [
        'File has been uploaded to your Google Drive',
        'File is now publicly shareable',
        'Copy the link and submit manually in Google Classroom',
        'Or share the link with your teacher',
      ],
    }
  } catch (error: any) {
    console.error('Error in upload-only method:', error)
    throw new Error('Failed to upload and share file')
  }
}

export const turnInAssignmentWithFileSimple = async (
  accessToken: string,
  courseId: string,
  courseWorkId: string,
  submissionId: string,
  driveFileId: string,
) => {
  const oauth2Client = createOAuth2Client(accessToken)
  const classroom = google.classroom({ version: 'v1', auth: oauth2Client })
  const drive = google.drive({ version: 'v3', auth: oauth2Client })

  try {
    // 1. Hacer el archivo público o compartido (opcional)
    try {
      await drive.permissions.create({
        fileId: driveFileId,
        requestBody: {
          role: 'reader',
          type: 'anyone', // o 'domain' si quieres limitarlo a tu dominio
        },
      })
      console.log('File permissions set successfully')
    } catch (permError: any) {
      console.warn('Could not set file permissions:', permError.message)
      // Continuar sin permisos públicos
    }

    // 2. Solo marcar como entregado (sin adjuntar el archivo)
    const turnInResponse = await classroom.courses.courseWork.studentSubmissions.turnIn({
      courseId,
      courseWorkId,
      id: submissionId,
    })

    return {
      success: true,
      submission: turnInResponse.data,
      driveFileId,
      note: 'File uploaded to Drive but not attached to submission due to API limitations. Share the Drive link manually if needed.',
    }
  } catch (error) {
    console.error('Error in simple file submission:', error)
    throw new Error('Failed to submit assignment with file')
  }
}

export const getDriveFileLink = async (accessToken: string, driveFileId: string) => {
  const oauth2Client = createOAuth2Client(accessToken)
  const drive = google.drive({ version: 'v3', auth: oauth2Client })

  try {
    const file = await drive.files.get({
      fileId: driveFileId,
      fields: 'id,name,webViewLink,webContentLink,mimeType,size',
    })

    return {
      id: file.data.id,
      name: file.data.name,
      viewLink: file.data.webViewLink,
      downloadLink: file.data.webContentLink,
      mimeType: file.data.mimeType,
      size: file.data.size,
    }
  } catch (error) {
    console.error('Error getting Drive file link:', error)
    throw new Error('Failed to get file link')
  }
}
// ...existing code...

export const turnInAssignmentWithFile = async (
  accessToken: string,
  courseId: string,
  courseWorkId: string,
  submissionId: string,
  driveFileId: string,
) => {
  try {
    console.log('🚀 Starting turnInAssignmentWithFile process...', {
      courseId,
      courseWorkId,
      submissionId,
      driveFileId,
    })

    // Setup Google APIs - Usar createOAuth2Client para consistencia
    const oauth2Client = createOAuth2Client(accessToken)

    // Verificar que el token tenga los scopes necesarios
    try {
      const tokenInfo = await oauth2Client.getTokenInfo(accessToken)
      console.log('Token scopes:', tokenInfo.scopes)
    } catch (error) {
      console.warn('Could not verify token scopes:', error)
    }

    const classroom = google.classroom({ version: 'v1', auth: oauth2Client })
    const drive = google.drive({ version: 'v3', auth: oauth2Client })

    // 1. Verify file exists and get info
    let fileInfo
    try {
      const fileResponse = await drive.files.get({
        fileId: driveFileId,
        fields: 'id, name, mimeType, size, webViewLink, webContentLink',
      })
      fileInfo = fileResponse.data
      console.log('✅ File verified:', fileInfo.name)
    } catch (error: any) {
      console.error('❌ File not found in Drive:', error)
      throw new Error('File not found in Drive')
    }

    // 2. Update file permissions for classroom access
    try {
      await drive.permissions.create({
        fileId: driveFileId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      })
      console.log('✅ File permissions updated')
    } catch (error: any) {
      console.warn('⚠️ Could not update file permissions:', error.message)
    }

    // 3. Attach file to submission - CORRECTED: Only send id
    console.log('📎 Attaching file to submission...')
    try {
      await classroom.courses.courseWork.studentSubmissions.modifyAttachments({
        courseId,
        courseWorkId,
        id: submissionId,
        requestBody: {
          addAttachments: [
            {
              driveFile: {
                id: driveFileId, // ✅ ONLY the id field
              },
            },
          ],
        },
      })
      console.log('✅ File attached successfully')
    } catch (attachError: any) {
      console.error('❌ Failed to attach file:', attachError)
      throw new Error(`Failed to attach file: ${attachError.message}`)
    }

    // 4. Turn in the assignment
    console.log('📤 Turning in assignment...')
    try {
      const turnInResult = await classroom.courses.courseWork.studentSubmissions.turnIn({
        courseId,
        courseWorkId,
        id: submissionId,
      })
      console.log('✅ Assignment turned in successfully')

      return {
        success: true,
        message: 'Assignment submitted with file attached',
        submissionId,
        driveFileId,
        fileName: fileInfo.name,
        fileLink: fileInfo.webViewLink,
      }
    } catch (turnInError: any) {
      console.error('❌ Failed to turn in assignment:', turnInError)
      throw new Error(`Failed to turn in assignment: ${turnInError.message}`)
    }
  } catch (error: any) {
    console.error('❌ Error in turnInAssignmentWithFile:', error)
    throw error
  }
}

export const attachFileToSubmission = async (
  accessToken: string,
  courseId: string,
  courseWorkId: string,
  submissionId: string,
  driveFileId: string,
) => {
  const oauth2Client = createOAuth2Client(accessToken)
  const classroom = google.classroom({ version: 'v1', auth: oauth2Client })
  const drive = google.drive({ version: 'v3', auth: oauth2Client })

  try {
    console.log('📎 Starting attachment process:', {
      courseId,
      courseWorkId,
      submissionId,
      driveFileId,
    })

    // 1. Verificar que el archivo existe en Drive
    const fileInfo = await drive.files.get({
      fileId: driveFileId,
      fields: 'id,name,mimeType,size',
    })

    console.log('✅ File verified in Drive:', fileInfo.data.name)

    // 2. Configurar permisos del archivo
    try {
      await drive.permissions.create({
        fileId: driveFileId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      })
      console.log('✅ File permissions updated')
    } catch (permError: any) {
      console.warn('⚠️ Could not update file permissions:', permError.message)
    }

    // 3. Adjuntar archivo usando modifyAttachments (SOLO el campo id)
    console.log('📎 Attempting to attach file to submission...')
    const attachResult = await classroom.courses.courseWork.studentSubmissions.modifyAttachments({
      courseId,
      courseWorkId,
      id: submissionId,
      requestBody: {
        addAttachments: [
          {
            driveFile: {
              id: driveFileId, // SOLO el campo id
            },
          },
        ],
      },
    })

    console.log('✅ File attached successfully to submission')

    return {
      success: true,
      message: 'File attached successfully to submission',
      attachment: attachResult.data,
      fileInfo: fileInfo.data,
      driveFileId,
    }
  } catch (error: any) {
    console.error('❌ Error in attachFileToSubmission:', {
      message: error.message,
      code: error.code,
      status: error.status,
      errors: error.errors,
    })

    throw new Error(`Failed to attach file: ${error.message}`)
  }
}

// ====== FUNCIONES DE DIAGNÓSTICO AVANZADAS ======

export const diagnosePermissions = async (accessToken: string) => {
  const oauth2Client = createOAuth2Client(accessToken)
  const classroom = google.classroom({ version: 'v1', auth: oauth2Client })
  const drive = google.drive({ version: 'v3', auth: oauth2Client })

  const results = {
    userProfile: null as any,
    listCourses: null as any,
    driveAccess: null as any,
    courseWorkAccess: null as any,
    submissionsAccess: null as any,
    errors: [] as any[],
  }

  try {
    // Test 1: Get user profile
    console.log('Testing user profile access...')
    try {
      const profile = await classroom.userProfiles.get({ userId: 'me' })
      results.userProfile = {
        success: true,
        data: {
          id: profile.data.id,
          name: profile.data.name?.fullName,
          emailAddress: profile.data.emailAddress,
          permissions: profile.data.permissions,
        },
      }
    } catch (error: any) {
      results.userProfile = { success: false, error: error.message }
      results.errors.push({ test: 'userProfile', error: error.message })
    }

    // Test 2: List courses
    console.log('Testing courses list access...')
    try {
      const courses = await classroom.courses.list({ pageSize: 3 })
      results.listCourses = {
        success: true,
        data: {
          count: courses.data.courses?.length || 0,
          courses: courses.data.courses?.map((c) => ({
            id: c.id,
            name: c.name,
            enrollmentCode: c.enrollmentCode,
          })),
        },
      }
    } catch (error: any) {
      results.listCourses = { success: false, error: error.message }
      results.errors.push({ test: 'listCourses', error: error.message })
    }

    // Test 3: Drive access
    console.log('Testing Drive access...')
    try {
      const driveFiles = await drive.files.list({ pageSize: 3 })
      results.driveAccess = {
        success: true,
        data: {
          count: driveFiles.data.files?.length || 0,
        },
      }
    } catch (error: any) {
      results.driveAccess = { success: false, error: error.message }
      results.errors.push({ test: 'driveAccess', error: error.message })
    }

    // Test 4: CourseWork access (using first available course)
    if (results.listCourses?.success && results.listCourses?.data?.courses?.length > 0) {
      const firstCourse = results.listCourses.data.courses[0]
      console.log(`Testing courseWork access for course ${firstCourse.id}...`)
      try {
        const courseWork = await classroom.courses.courseWork.list({
          courseId: firstCourse.id,
          pageSize: 3,
        })
        results.courseWorkAccess = {
          success: true,
          data: {
            courseId: firstCourse.id,
            courseName: firstCourse.name,
            count: courseWork.data.courseWork?.length || 0,
          },
        }
      } catch (error: any) {
        results.courseWorkAccess = { success: false, error: error.message }
        results.errors.push({ test: 'courseWorkAccess', error: error.message })
      }
    }

    // Test 5: Submissions access
    if (results.courseWorkAccess?.success && results.courseWorkAccess?.data?.count > 0) {
      console.log('Testing submissions access...')
      try {
        const submissions = await classroom.courses.courseWork.studentSubmissions.list({
          courseId: results.listCourses.data.courses[0].id,
          courseWorkId: 'dummy', // This will likely fail, but tells us about permissions
          userId: 'me',
        })
        results.submissionsAccess = {
          success: true,
          data: { count: submissions.data.studentSubmissions?.length || 0 },
        }
      } catch (error: any) {
        results.submissionsAccess = { success: false, error: error.message }
        results.errors.push({ test: 'submissionsAccess', error: error.message })
      }
    }

    return results
  } catch (error: any) {
    console.error('Error in diagnosePermissions:', error)
    results.errors.push({ test: 'general', error: error.message })
    return results
  }
}

export const testTurnInProcess = async (
  accessToken: string,
  courseId: string,
  courseWorkId: string,
) => {
  const oauth2Client = createOAuth2Client(accessToken)
  const classroom = google.classroom({ version: 'v1', auth: oauth2Client })

  try {
    console.log('Testing complete turnIn process...', { courseId, courseWorkId })

    // 1. Verificar que el courseWork existe
    const courseWork = await classroom.courses.courseWork.get({
      courseId,
      id: courseWorkId,
    })

    console.log('CourseWork details:', {
      id: courseWork.data.id,
      title: courseWork.data.title,
      state: courseWork.data.state,
      workType: courseWork.data.workType,
    })

    // 2. Obtener submissions del usuario
    const submissions = await classroom.courses.courseWork.studentSubmissions.list({
      courseId,
      courseWorkId,
      userId: 'me',
    })

    const userSubmissions = submissions.data.studentSubmissions || []
    console.log(
      'User submissions:',
      userSubmissions.map((s) => ({ id: s.id, state: s.state })),
    )

    // 3. Buscar submission pendiente
    const pendingSubmission = userSubmissions.find(
      (s) => s.state === 'CREATED' || s.state === 'NEW',
    )

    if (!pendingSubmission) {
      return {
        success: false,
        error: 'No pending submission found',
        availableSubmissions: userSubmissions,
      }
    }

    // 4. Test modifyAttachments permissions (sin archivo real)
    try {
      console.log('Testing modifyAttachments permissions...')
      // Este test debería fallar porque no hay archivo, pero nos dice sobre permisos
      await classroom.courses.courseWork.studentSubmissions.modifyAttachments({
        courseId,
        courseWorkId,
        id: pendingSubmission.id!,
        requestBody: {
          addAttachments: [],
        },
      })
      console.log('modifyAttachments test: SUCCESS (unexpected)')
    } catch (attachError: any) {
      console.log('modifyAttachments test result:', {
        error: attachError.message,
        code: attachError.code,
        isPERMISSION_DENIED: attachError.message?.includes('PERMISSION_DENIED'),
        isInvalidArgument: attachError.message?.includes('INVALID_ARGUMENT'),
      })
    }

    // 5. Test turnIn permissions
    try {
      console.log('Testing turnIn permissions (dry run)...')
      // Intentamos obtener la submission actual para verificar permisos
      const currentSubmission = await classroom.courses.courseWork.studentSubmissions.get({
        courseId,
        courseWorkId,
        id: pendingSubmission.id!,
      })

      return {
        success: true,
        courseWork: {
          id: courseWork.data.id,
          title: courseWork.data.title,
          state: courseWork.data.state,
        },
        submission: {
          id: currentSubmission.data.id,
          state: currentSubmission.data.state,
          userId: currentSubmission.data.userId,
        },
        permissions: {
          canAccessSubmission: true,
          canModifyAttachments: 'needs_file_test',
          canTurnIn: 'needs_actual_test',
        },
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
        permissions: {
          canAccessSubmission: false,
          canModifyAttachments: false,
          canTurnIn: false,
        },
      }
    }
  } catch (error: any) {
    console.error('Error in testTurnInProcess:', error)
    return {
      success: false,
      error: error.message,
      code: error.code,
    }
  }
}

export const validateStudentPermissions = async (
  accessToken: string,
  courseId: string,
  courseWorkId: string,
) => {
  const oauth2Client = createOAuth2Client(accessToken)
  const classroom = google.classroom({ version: 'v1', auth: oauth2Client })

  try {
    console.log('🔍 Validating student permissions...')

    // 1. Verificar que el usuario está inscrito en el curso
    const course = await classroom.courses.get({ id: courseId })
    console.log('✅ Course accessible:', course.data.name)

    // 2. Verificar acceso al courseWork
    const courseWork = await classroom.courses.courseWork.get({
      courseId,
      id: courseWorkId,
    })
    console.log('✅ CourseWork accessible:', courseWork.data.title)

    // 3. Verificar que el estudiante tiene una submission
    const submissions = await classroom.courses.courseWork.studentSubmissions.list({
      courseId,
      courseWorkId,
      userId: 'me', // ✅ Esto asegura que usamos la identidad del estudiante
    })

    const userSubmissions = submissions.data.studentSubmissions || []
    const pendingSubmission = userSubmissions.find(
      (s) => s.state === 'CREATED' || s.state === 'NEW',
    )

    if (!pendingSubmission) {
      throw new Error('No pending submission found for this student')
    }

    console.log('✅ Valid submission found:', {
      id: pendingSubmission.id,
      state: pendingSubmission.state,
    })

    return {
      success: true,
      courseId,
      courseWorkId,
      submissionId: pendingSubmission.id,
      courseName: course.data.name,
      assignmentTitle: courseWork.data.title,
      submissionState: pendingSubmission.state,
    }
  } catch (error: any) {
    console.error('❌ Permission validation failed:', error.message)

    // Proporcionar información específica sobre el tipo de error
    if (error.code === 403) {
      throw new Error(
        'Insufficient permissions. The user may not be enrolled in this course or lacks necessary scopes.',
      )
    } else if (error.code === 404) {
      throw new Error('Course or assignment not found. Verify the IDs are correct.')
    } else {
      throw new Error(`Permission validation failed: ${error.message}`)
    }
  }
}

export const listCourses = async (accessToken: string) => {
  const oauth2Client = createOAuth2Client(accessToken)
  const classroom = google.classroom({ version: 'v1', auth: oauth2Client })

  try {
    const response = await classroom.courses.list({
      courseStates: ['ACTIVE'],
    })
    return response.data.courses || []
  } catch (error: any) {
    console.error('Error listing courses:', error)
    throw new Error('Failed to list courses')
  }
}
