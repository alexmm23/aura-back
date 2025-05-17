import { google } from 'googleapis'
import env from '@/config/enviroment'

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = env

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
)
export const getGoogleAuthUrl = ({ state }: { state: string }) => {
  const scopes = ['https://www.googleapis.com/auth/classroom.courses.readonly']
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
