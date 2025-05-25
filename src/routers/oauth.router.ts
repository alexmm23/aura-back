import { Router } from 'express'
import { ConfidentialClientApplication, AuthorizationCodeRequest } from '@azure/msal-node'
import env from '@/config/enviroment'
import { authenticateToken } from '@/middlewares/auth.middleware'
import { googleAuthMiddleware } from '@/middlewares/googleAuth.middleware'
import { UserAccount } from '@/models/userAccount.model'
import { User } from '@/models/user.model'

const router = Router()

const {
  MS_CLIENT_ID: clientId,
  MS_CLIENT_SECRET: clientSecret,
  MS_TENANT_ID: tenantId,
  SERVER_URL,
} = env

const redirectUri = `${SERVER_URL}/api/auth/microsoft/callback`
const scopes = ['openid', 'profile', 'offline_access', 'User.Read', 'Team.ReadBasic.All']

// Configura MSAL
const msalConfig = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    clientSecret,
  },
}
const cca = new ConfidentialClientApplication(msalConfig)

// Step 1: Redirect user to Microsoft login
router.get('/microsoft', authenticateToken, (req, res) => {
  // Incluye el token del usuario autenticado en el parámetro state
  const userToken = req.headers.authorization?.split(' ')[1] || ''
  const authCodeUrlParameters = {
    scopes,
    redirectUri,
    state: userToken, // El token del usuario se enviará en el state
    prompt: 'consent', // Asegúrate de que el usuario consienta los permisos
  }
  cca
    .getAuthCodeUrl(authCodeUrlParameters)
    .then((response) => {
      console.log('Microsoft Auth URL:', response)
      res.json({ url: response }) // Enviar la URL de autenticación
      // res.redirect(response)
    })
    .catch((error) => {
      res.status(500).json({ error: 'Failed to get auth code URL', details: error })
    })
})

// Step 2: Handle callback and exchange code for tokens
router.get('/microsoft/callback', googleAuthMiddleware, authenticateToken, async (req, res) => {
  const code = req.query.code as string
  // const state = req.query.state as string
  if (!code) {
    res.status(400).json({ error: 'No code provided' })
    return
  }
  const tokenRequest: AuthorizationCodeRequest = {
    code,
    scopes,
    redirectUri,
  }
  const userId = (req as any).user?.id
  if (!userId) {
    res.status(400).json({ error: 'No user ID found in request' })
    return
  }
  const existingAccount = await UserAccount.findOne({
    where: {
      user_id: userId,
      platform: 'google',
    },
  })
  const { email, password } = await User.findOne({
    where: {
      id: userId,
    },
  })
  try {
    const response = await cca.acquireTokenByCode(tokenRequest)
    if (!response) {
      res.status(400).json({ error: 'Failed to acquire token' })
      return
    }
    const { accessToken, expiresOn } = response
    const tokens = {
      access_token: accessToken,
      expiry_date: expiresOn ? new Date(expiresOn) : null,
    }
    if (existingAccount) {
      const expiryDate = new Date(
        tokens.expiry_date ? tokens.expiry_date : Date.now() + 3600 * 1000,
      )

      await UserAccount.update(
        {
          access_token: tokens.access_token,
          // refresh_token is not available from Microsoft response
          expiry_date: expiryDate,
        },
        { where: { user_id: userId, platform: 'google' } },
      )
    } else {
      await UserAccount.create({
        user_id: userId,
        platform: 'google',
        access_token: tokens.access_token,
        // refresh_token is not available from Microsoft response
        username: email,
        password: password,
        expiry_date: new Date(tokens.expiry_date ? tokens.expiry_date : Date.now() + 3600 * 1000),
      })
    }
    console.log('Microsoft Token Response:', response)
    res.redirect(`${env.FRONTEND_URL}/profile`)
  } catch (err) {
    res.status(500).json({ error: 'Token exchange failed', details: err })
  }
})

export default router
