// Types for Moodle integration

export interface MoodleLoginRequest {
  username: string
  password: string
  moodle_url: string // URL base de la instancia de Moodle del usuario
}

export interface MoodleLoginResponse {
  token: string
  privatetoken?: string
  user_id: number
  username: string
  firstname: string
  lastname: string
  fullname: string
  email: string
}

export interface MoodleCourse {
  id: number
  shortname: string
  fullname: string
  timemodified: number
  displayname?: string
  enrolledusercount?: number
  idnumber?: string
  visible?: number
  summary?: string
  summaryformat?: number
  format?: string
  showgrades?: boolean
  lang?: string
  enablecompletion?: boolean
  category?: number
  progress?: number
  completed?: boolean
  startdate?: number
  enddate?: number
  marker?: number
  lastaccess?: number
  isfavourite?: boolean
  hidden?: boolean
  overviewfiles?: any[]
}

export interface MoodleAssignment {
  id: number
  course: number
  courseName?: string
  courseShortname?: string
  name: string
  intro: string
  introformat: number
  alwaysshowdescription: number
  nosubmissions: number
  submissiondrafts: number
  sendnotifications: number
  sendlatenotifications: number
  duedate: number
  allowsubmissionsfromdate: number
  grade: number
  timemodified: number
  completionsubmit: number
  cutoffdate: number
  gradingduedate: number
  teamsubmission: number
  requireallteammemberssubmit: number
  teamsubmissiongroupingid: number
  blindmarking: number
  hidegrader: number
  revealidentities: number
  attemptreopenmethod: string
  maxattempts: number
  markingworkflow: number
  markingallocation: number
  requiresubmissionstatement: number
  preventsubmissionnotingroup: number
  configs?: any[]
  // Submission info
  submission?: {
    id: number
    userid: number
    attemptnumber: number
    timecreated: number
    timemodified: number
    status: 'new' | 'draft' | 'submitted' | 'reopened'
    groupid: number
    plugins?: any[]
  }
}

export interface MoodleSubmission {
  assignmentid: number
  userid: number
  onlinetext?: string
  files?: MoodleFile[]
}

export interface MoodleFile {
  filename: string
  filepath: string
  filesize: number
  fileurl?: string
  mimetype?: string
  content?: string // base64 for upload
}

export interface MoodleUploadedFile {
  component: string
  contextid: number
  userid: number
  filearea: string
  filename: string
  filepath: string
  itemid: number
  license: string
  author: string
  source: string
}

export interface MoodleAssignmentSubmissionResponse {
  success: boolean
  message?: string
  itemid?: number
}

// Unified assignment interface para combinar Classroom y Moodle
export interface UnifiedAssignment {
  id: string
  title: string
  description: string
  dueDate: string | null
  dueTime: string | null
  maxPoints: number | null
  courseName: string
  courseId: string
  status: 'assigned' | 'submitted' | 'graded' | 'late' | 'missing'
  source: 'classroom' | 'moodle'
  submissionStatus?: string
  grade?: number | string
  link?: string
  // Moodle specific
  allowSubmissionsFromDate?: number
  cutoffDate?: number
  // Classroom specific
  alternateLink?: string
  materials?: any[]
}

export interface MoodleConfig {
  user_id: number
  moodle_url: string
  token: string
}

export interface MoodleErrorResponse {
  error?: string
  errorcode?: string
  message?: string
  debuginfo?: string
  reproductionlink?: string
  exception?: string
}
