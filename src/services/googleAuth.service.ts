import { google } from 'googleapis'
import env from '@/config/enviroment'
import { UserAccount } from '@/models/userAccount.model'

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = env

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
)

export const createOAuth2Client = (accessToken: string) => {
  const client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI)
  client.setCredentials({ access_token: accessToken })
  return client
}

export const getGoogleAuthUrl = ({ state }: { state: string }) => {
  const scopes = [
    'https://www.googleapis.com/auth/classroom.courses.readonly',
    'https://www.googleapis.com/auth/drive.file', // ← Agrega este para subir archivos
    'https://www.googleapis.com/auth/classroom.coursework.me', // Para entregar tareas
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
  try {
    const userAccount = await UserAccount.findOne({
      where: {
        user_id: userId,
        platform: 'google',
      },
    })

    if (!userAccount || !userAccount.refresh_token) {
      throw new Error('User account or refresh token not found')
    }

    const { refresh_token } = userAccount
    oauth2Client.setCredentials({ refresh_token })
    const { credentials } = await oauth2Client.refreshAccessToken()

    // Actualiza el nuevo access token en la base de datos
    await UserAccount.update(
      {
        access_token: credentials.access_token,
        expiry_date: new Date(credentials.expiry_date || Date.now() + 3600 * 1000),
      },
      { where: { user_id: userId, platform: 'google' } },
    )

    return credentials.access_token
  } catch (error: any) {
    if (error.message.includes('invalid_grant')) {
      // El refresh token no es válido, elimina la cuenta y solicita nueva autorización
      await UserAccount.destroy({
        where: { user_id: userId, platform: 'google' },
      })
      throw new Error('Refresh token expired. User needs to re-authorize.')
    }
    throw error
  }
}
