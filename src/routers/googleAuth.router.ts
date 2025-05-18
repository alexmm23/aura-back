// routes/googleAuth.router.ts
import { Router, Request, Response } from 'express'
import { getGoogleAuthUrl, getTokensFromCode } from '@/services/googleAuth.service'
import { UserAccount } from '@/models/userAccount.model'
import { authenticateToken } from '@/middlewares/auth.middleware'
import { UserAttributes } from '@/types/user.types'
import { googleAuthMiddleware } from '@/middlewares/googleAuth.middleware'
import { User } from '@/models/user.model'
const router = Router()

// Redireccionar a Google
router.get('/auth/google', authenticateToken, (req: Request & { user?: UserAttributes }, res) => {
  const userId = req.user?.id
  if (!userId) {
    res.status(400).send('No se pudo obtener el ID de usuario.')
    return
  }
  const state = req.headers['authorization']?.split(' ')[1] as string
  if (!state) {
    res.status(400).send('No se pudo obtener el token de autorización.')
    return
  }
  const url = getGoogleAuthUrl({ state })
  res.json({ url })
})

// Callback de Google
router.get(
  '/auth/google/callback',
  googleAuthMiddleware,
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    if (!req.user) {
      res.status(400).send('No se pudo obtener el ID de usuario.')
      return
    }
    try {
      // Aquí deberías obtener el user_id desde tu sistema de autenticación
      const userId = req.user.id
      // Verifica si el usuario ya tiene una cuenta de Google
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
      const { code } = req.query
      if (!code || typeof code !== 'string') {
        res.status(400).send('No se proporcionó el código de autorización.')
        return
      }
      // Intercambia el código por un token de acceso
      const tokens = await getTokensFromCode(code)
      if (!tokens || !tokens.access_token) {
        res.status(400).send('No se pudo obtener el token de acceso.')
        return
      }
      if (existingAccount) {
        // Si ya existe, actualiza el token
        await UserAccount.update(
          { access_token: tokens.access_token, refresh_token: tokens.refresh_token },
          { where: { user_id: userId, platform: 'google' } },
        )
      } else {
        await UserAccount.create({
          user_id: userId,
          platform: 'google',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          username: email,
          password: password,
        })
      }

      res.redirect('http://localhost:8081/profile')
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  },
)

export { router as googleAuthRouter }
