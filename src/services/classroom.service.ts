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
      // Parallelize fetching submissions for all courseWork
      const assignments = await Promise.all(
        courseWork.map(async (work) => {
          const submissionsResponse = await classroom.courses.courseWork.studentSubmissions.list({
            courseId,
            courseWorkId: work.id!,
            userId: 'me',
          })
          const submissions = submissionsResponse.data.studentSubmissions || []
          const notTurnedIn = submissions.some(
            (submission) => submission.state === 'CREATED' || submission.state === 'NEW',
          )
          if (notTurnedIn) {
            return {
              id: work.id,
              title: work.title,
              courseId,
              courseWorkId: work.id,
              submissionId: submissions[0]?.id || null,
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
) => {
  const oauth2Client = createOAuth2Client(accessToken)
  const drive = google.drive({ version: 'v3', auth: oauth2Client })

  const fileMetadata = {
    name: fileName,
  }

  const media = {
    mimeType: 'application/octet-stream',
    body: Readable.from(fileBuffer), // Convierte Buffer a stream directamente
  }

  try {
    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
    })

    return file.data.id
  } catch (error) {
    console.error('Error uploading file to Drive:', error)
    throw new Error('Failed to upload file to Google Drive')
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
    // Solo adjuntamos el archivo sin marcar como entregado
    const response = await classroom.courses.courseWork.studentSubmissions.modifyAttachments({
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

    return {
      success: true,
      submission: response.data,
    }
  } catch (error) {
    console.error('Error adding file to assignment:', error)
    throw new Error('Failed to add file to assignment')
  }
}
