import axios, { AxiosInstance } from 'axios'
import {
  MoodleLoginRequest,
  MoodleLoginResponse,
  MoodleCourse,
  MoodleAssignment,
  MoodleSubmission,
  MoodleFile,
  MoodleUploadedFile,
  MoodleAssignmentSubmissionResponse,
  MoodleErrorResponse,
  MoodleConfig,
} from '../types/moodle.types.js'
import { UserAccount } from '../models/userAccount.model.js'
import FormData from 'form-data'

export class MoodleService {
  public baseUrl: string
  private token: string
  private axiosInstance: AxiosInstance

  constructor(config: MoodleConfig) {
    this.baseUrl = config.moodle_url.endsWith('/')
      ? config.moodle_url.slice(0, -1)
      : config.moodle_url
    this.token = config.token

    this.axiosInstance = axios.create({
      baseURL: `${this.baseUrl}/webservice/rest/server.php`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })
  }

  /**
   * Login to Moodle and get token
   */
  static async login(loginData: MoodleLoginRequest, role: string): Promise<MoodleLoginResponse> {
    try {
      const baseUrl = loginData.moodle_url.endsWith('/')
        ? loginData.moodle_url.slice(0, -1)
        : loginData.moodle_url
      console.log('Attempting Moodle login at:', baseUrl)
      const service = role === 'alumno' ? 'moodle_mobile_app' : 'ts'
      
      const response = await axios.post(
        `${baseUrl}/login/token.php`,
        new URLSearchParams({
          username: loginData.username,
          password: loginData.password,
          service: service,
        }),
        {
          headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      )
      console.log('Moodle login response:', response.data)

      if (response.data.error) {
        throw new Error(response.data.error)
      }

      if (!response.data.token) {
        throw new Error('No token received from Moodle')
      }

      // Get user info
      const userInfo = await MoodleService.getUserInfo(baseUrl, response.data.token)

      return {
        token: response.data.token,
        privatetoken: response.data.privatetoken,
        user_id: userInfo.userid,
        username: userInfo.username,
        firstname: userInfo.firstname,
        lastname: userInfo.lastname,
        fullname: userInfo.fullname,
        email: userInfo.email,
      }
    } catch (error: any) {
      console.error('Moodle login error:', error.response?.data || error.message)
      throw new Error(error.response?.data?.error || error.message || 'Failed to login to Moodle')
    }
  }

  /**
   * Get user info from token
   */
  private static async getUserInfo(baseUrl: string, token: string): Promise<any> {
    try {
      const response = await axios.post(
        `${baseUrl}/webservice/rest/server.php`,
        new URLSearchParams({
          wstoken: token,
          wsfunction: 'core_webservice_get_site_info',
          moodlewsrestformat: 'json',
        }),
      )

      return response.data
    } catch (error: any) {
      console.error('Error getting user info:', error)
      throw new Error('Failed to get user information from Moodle')
    }
  }

  /**
   * Save Moodle credentials to user_accounts
   */
  static async saveMoodleAccount(
    userId: number,
    moodleData: MoodleLoginResponse,
    moodleUrl: string,
  ): Promise<any> {
    try {
      // Check if account already exists
      const existingAccount = await UserAccount.findOne({
        where: {
          user_id: userId,
          platform: 'moodle',
        },
      })

      const accountData = {
        user_id: userId,
        platform: 'moodle',
        provider_account_id: moodleData.user_id.toString(),
        access_token: moodleData.token,
        refresh_token: moodleData.privatetoken || null,
        expiry_date: null, // Moodle tokens don't expire by default
        email: moodleData.email,
        name: moodleData.fullname,
        username: moodleData.username,
        firstname: moodleData.firstname,
        lastname: moodleData.lastname,
        provider_url: moodleUrl, // Guardar URL de Moodle directamente,
        password: 'password', // Placeholder password
      }

      if (existingAccount) {
        await existingAccount.update(accountData)
        return existingAccount
      } else {
        return await UserAccount.create(accountData)
      }
    } catch (error: any) {
      console.error('Error saving Moodle account:', error)
      throw new Error('Failed to save Moodle account')
    }
  }

  /**
   * Get Moodle service instance for a user
   */
  static async getServiceForUser(userId: number): Promise<MoodleService | null> {
    try {
      const account = await UserAccount.findOne({
        where: {
          user_id: userId,
          platform: 'moodle',
        },
      })

      if (!account) {
        return null
      }

      const moodleUrl = account.getDataValue('provider_url')

      if (!moodleUrl) {
        throw new Error('Moodle URL not found in account data')
      }

      return new MoodleService({
        user_id: userId,
        moodle_url: moodleUrl,
        token: account.getDataValue('access_token'),
      })
    } catch (error: any) {
      console.error('Error getting Moodle service:', error)
      return null
    }
  }

  /**
   * Generic API call to Moodle
   */
  private async callMoodleAPI(wsfunction: string, params: any = {}): Promise<any> {
    try {
      const searchParams = new URLSearchParams({
        wstoken: this.token,
        wsfunction,
        moodlewsrestformat: 'json',
        ...params,
      })

      const response = await this.axiosInstance.post('', searchParams)

      // Check for Moodle errors
      if (response.data.exception || response.data.errorcode) {
        throw new Error(response.data.message || response.data.error || 'Moodle API error')
      }

      return response.data
    } catch (error: any) {
      console.error(`Moodle API error (${wsfunction}):`, error.response?.data || error.message)
      throw error
    }
  }

  /**
   * Get user's enrolled courses
   */
  async getUserCourses(): Promise<MoodleCourse[]> {
    try {
      const data = await this.callMoodleAPI('core_enrol_get_users_courses')

      return data as MoodleCourse[]
    } catch (error: any) {
      console.error('Error getting courses:', error)
      throw new Error('Failed to get courses from Moodle')
    }
  }

  /**
   * Get assignments for a course
   */
  async getCourseAssignments(courseId: number): Promise<MoodleAssignment[]> {
    try {
      const data = await this.callMoodleAPI('mod_assign_get_assignments')
      if (data.courses && data.courses.length > 0) {
        return data.courses.flatMap((course: any) =>
          (course.assignments || []).map((assignment: any) => ({
            ...assignment,
            courseName: course.fullname,
            courseShortName: course.shortname,
          })),
        )
      }
      return []
    } catch (error: any) {
      throw new Error('Failed to get assignments from Moodle')
    }
  }

  /**
   * Get all assignments from all enrolled courses
   */
  async getAllAssignments(): Promise<MoodleAssignment[]> {
    try {
      const allAssignments: MoodleAssignment[] = []
      try {
        const assignments = await this.getCourseAssignments(0)
        console.log('Assignments retrieved for course 0:', assignments)

        // Add course info to each assignment
        const assignmentsWithCourse = assignments.map((assignment) => ({
          ...assignment,
        }))
        allAssignments.push(...assignmentsWithCourse)
      } catch (error) {
        console.error(`Error getting assignments for course 0:`, error)
      }

      return allAssignments
    } catch (error: any) {
      console.error('Error getting all assignments:', error)
      throw new Error('Failed to get assignments from Moodle')
    }
  }

  /**
   * Get submission status for an assignment
   */
  async getSubmissionStatus(assignmentId: number): Promise<any> {
    try {
      const data = await this.callMoodleAPI('mod_assign_get_submission_status', {
        assignid: assignmentId,
      })

      return data
    } catch (error: any) {
      console.error('Error getting submission status:', error)
      throw new Error('Failed to get submission status from Moodle')
    }
  }

  /**
   * Upload a file to Moodle
   */
  async uploadFile(
    filename: string,
    fileContent: string,
    mimeType: string,
  ): Promise<MoodleUploadedFile> {
    try {
      // Decode base64 if needed
      const base64Data = fileContent.replace(/^data:.*?;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')

      const formData = new FormData()
      formData.append('token', this.token)
      formData.append('filearea', 'draft')
      formData.append('itemid', '0')
      formData.append('file', buffer, {
        filename: filename,
        contentType: mimeType,
      })

      const response = await axios.post(`${this.baseUrl}/webservice/upload.php`, formData, {
        headers: {
          ...formData.getHeaders(),
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      })

      if (response.data.error) {
        throw new Error(response.data.error)
      }

      if (!response.data[0]) {
        throw new Error('No file data received from Moodle')
      }

      return response.data[0]
    } catch (error: any) {
      console.error('Error uploading file to Moodle:', error.response?.data || error.message)
      throw new Error('Failed to upload file to Moodle')
    }
  }

  /**
   * Submit an assignment
   */
  async submitAssignment(
    assignmentId: number,
    submissionData: {
      onlinetext?: string
      files?: Array<{ filename: string; content: string; mimeType: string }>
    },
  ): Promise<MoodleAssignmentSubmissionResponse> {
    try {
      const params: any = {
        assignmentid: assignmentId,
      }

      // Upload files if provided
      if (submissionData.files && submissionData.files.length > 0) {
        const uploadedFiles = []

        for (const file of submissionData.files) {
          const uploadedFile = await this.uploadFile(file.filename, file.content, file.mimeType)
          uploadedFiles.push(uploadedFile)
        }

        // Use the itemid from the first uploaded file
        if (uploadedFiles.length > 0) {
          params['plugindata[files_filemanager]'] = uploadedFiles[0].itemid
        }
      }

      // Add online text if provided
      if (submissionData.onlinetext) {
        params['plugindata[onlinetext_editor][text]'] = submissionData.onlinetext
        params['plugindata[onlinetext_editor][format]'] = 1 // HTML format
      }

      const data = await this.callMoodleAPI('mod_assign_save_submission', params)

      return {
        success: true,
        message: 'Assignment submitted successfully',
        itemid: data.itemid,
      }
    } catch (error: any) {
      console.error('Error submitting assignment:', error)
      throw new Error(error.message || 'Failed to submit assignment to Moodle')
    }
  }

  /**
   * Get assignment grades
   */
  async getAssignmentGrades(assignmentId: number): Promise<any> {
    try {
      const data = await this.callMoodleAPI('mod_assign_get_grades', {
        'assignmentids[0]': assignmentId,
      })

      return data
    } catch (error: any) {
      console.error('Error getting assignment grades:', error)
      throw new Error('Failed to get assignment grades from Moodle')
    }
  }
  async getCourses(): Promise<MoodleCourse[]> {
    try {
      const data = await this.callMoodleAPI('mod_assign_get_assignments')

      if (data.courses && data.courses.length > 0) {
        return data.courses as MoodleCourse[]
      }

      return data
    } catch (error: any) {
      console.error('Error getting courses from Moodle:', error)
      throw new Error('Failed to get courses from Moodle')
    }
  }

  /**
   * Get course announcements/forum posts
   */
  async getCourseAnnouncements(courseId: number): Promise<any[]> {
    try {
      // Get forum discussions from the course
      const data = await this.callMoodleAPI('mod_forum_get_forums_by_courses', {
        'courseids[0]': courseId,
      })

      if (!data || data.length === 0) {
        return []
      }

      // Get discussions for each forum
      const allAnnouncements = []
      for (const forum of data) {
        try {
          const discussions = await this.callMoodleAPI('mod_forum_get_forum_discussions', {
            forumid: forum.id,
          })

          if (discussions && discussions.discussions) {
            const formattedDiscussions = discussions.discussions.map((disc: any) => ({
              id: disc.id,
              name: disc.name,
              message: disc.message,
              created: disc.created,
              modified: disc.modified,
              usermodified: disc.usermodified,
              timemodified: disc.timemodified,
              userid: disc.userid,
              forumid: forum.id,
              forumname: forum.name,
            }))
            allAnnouncements.push(...formattedDiscussions)
          }
        } catch (error) {
          console.warn(`Could not get discussions for forum ${forum.id}:`, error)
        }
      }

      return allAnnouncements
    } catch (error: any) {
      console.error('Error getting announcements:', error)
      throw new Error('Failed to get announcements from Moodle')
    }
  }
}
