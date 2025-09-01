import { google } from 'googleapis'
import { createOAuth2Client } from './googleAuth.service'
import { Readable } from 'stream'

export const getClassroomAssignments = async (accessToken: string) => {
  const oauth2Client = createOAuth2Client(accessToken)
  const classroom = google.classroom({ version: 'v1', auth: oauth2Client })
  try {
    const response = await classroom.courses.list({
      pageSize: 10,
      courseStates: ['ACTIVE'],
    })
    const courses = response.data.courses || []

    // Parallelize fetching courseWork for all courses
    const courseWorkPromises = courses.map(async (course) => {
      const { id: courseId, name } = course
      if (!courseId || !name) return []
      const courseWorkResponse = await classroom.courses.courseWork.list({
        courseId,
        pageSize: 10,
      })
      const courseWork = courseWorkResponse.data.courseWork || []
      console.log(courseWork)
      // Parallelize fetching submissions for all courseWork
      const assignments = await Promise.all(
        courseWork.map(async (work) => {
          const submissionsResponse = await classroom.courses.courseWork.studentSubmissions.list({
            courseId,
            courseWorkId: work.id!,
            userId: 'me',
          })
          const submissions = submissionsResponse.data.studentSubmissions || []
          console.log(
            'Submissions for courseWork:',
            work.id,
            submissions.map((s) => ({ id: s.id, state: s.state })),
          )

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
        }),
      )
      return assignments.filter(Boolean)
    })

    const results = await Promise.all(courseWorkPromises)
    // Flatten the array and remove nulls
    return results.flat()
  } catch (error) {
    console.error('Error fetching assignments:', error)
    throw new Error('Failed to fetch assignments')
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

export const turnInAssignmentWithFile = async (
  accessToken: string,
  courseId: string,
  courseWorkId: string,
  submissionId: string,
  driveFileId: string,
) => {
  const oauth2Client = createOAuth2Client(accessToken)
  const classroom = google.classroom({ version: 'v1', auth: oauth2Client })

  try {
    // Primero adjuntamos el archivo
    const attachmentResponse =
      await classroom.courses.courseWork.studentSubmissions.modifyAttachments({
        courseId,
        courseWorkId,
        id: submissionId,
        requestBody: {
          addAttachments: [
            {
              driveFile: {
                id: driveFileId,
              },
            },
          ],
        },
      })

    // Luego marcamos la tarea como entregada
    const turnInResponse = await classroom.courses.courseWork.studentSubmissions.turnIn({
      courseId,
      courseWorkId,
      id: submissionId,
    })

    return {
      success: true,
      submission: attachmentResponse.data,
      turnInResult: turnInResponse.data,
    }
  } catch (error) {
    console.error('Error adding file to assignment:', error)
    throw new Error('Failed to add file to assignment')
  }
}
