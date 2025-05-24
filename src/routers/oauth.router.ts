import { Router } from 'express'
import axios from 'axios'
import querystring from 'querystring'

const router = Router()

const clientId = process.env.MS_CLIENT_ID
const clientSecret = process.env.MS_CLIENT_SECRET
const tenantId = process.env.MS_TENANT_ID
const redirectUri = 'http://localhost:3000/auth/microsoft/callback'
const scopes = [
  'openid',
  'profile',
  'offline_access',
  'User.Read',
  'Team.ReadBasic.All'
].join(' ')

// Step 1: Redirect user to Microsoft login
router.get('/microsoft', (req, res) => {
  const params = querystring.stringify({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: scopes,
    state: '12345'
  })
  res.redirect(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params}`)
})

// Step 2: Handle callback and exchange code for tokens
router.get('/microsoft/callback', async (req, res) => {
  const code = req.query.code as string
  try {
    const tokenResponse = await axios.post(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      querystring.stringify({
        client_id: clientId,
        scope: scopes,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        client_secret: clientSecret
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    )
    // You get access_token and refresh_token here
    res.json(tokenResponse.data)
  } catch (err) {
    res.status(500).json({ error: 'Token exchange failed', details: err })
  }
})

export default router