import { google } from 'googleapis'
import env from '@/config/enviroment'
import { UserAccount } from '@/models/userAccount.model'

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = env

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
)
export const getGoogleAuthUrl = ({ state }: { state: string }) => {
  const scopes = [
    'https://www.googleapis.com/auth/classroom.courses.readonly',
    'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
    'https://www.googleapis.com/auth/classroom.student-submissions.me.readonly',
  ]
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
    state,
  })
  return url
  // return oauth2Client.generateAuthUrl({
  //   access_type: 'offline',
  //   scope: scopes,
  //   prompt: 'consent',
  // })
}
export const getTokensFromCode = async (code: string) => {
  const { tokens } = await oauth2Client.getToken(code)
  return tokens
}
export const setCredentials = (tokens: any) => {
  oauth2Client.setCredentials(tokens)
  return oauth2Client
}

export const getNewAccessToken = async (userId: number | undefined) => {
  const userAccount = await UserAccount.findOne({
    where: {
      user_id: userId,
      platform: 'google',
    },
  })
  if (!userAccount) {
    throw new Error('User account not found')
  }
  const { refresh_token } = userAccount
  oauth2Client.setCredentials({ refresh_token })
  const { credentials } = await oauth2Client.refreshAccessToken()
  await UserAccount.update(
    {
      access_token: credentials.access_token,
      expiry_date: credentials.expiry_date,
    },
    {
      where: {
        user_id: userId,
        platform: 'google',
      },
    },
  )
  return credentials
}
