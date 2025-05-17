// routes/googleAuth.router.ts
import { Router, Request, Response } from 'express'
import { getGoogleAuthUrl, getTokensFromCode } from '@/services/googleAuth.service'
import { UserAccount } from '@/models/userAccount.model'
import { authenticateToken } from '@/middlewares/auth.middleware'
import { UserAttributes } from '@/types/user.types'
const router = Router()

// Redireccionar a Google
router.get('/auth/google', authenticateToken, (req: Request & { user?: UserAttributes }, res) => {
  // Verifica si el usuario ya está autenticado
  // if (req.user) {
  //   res.status(400).send('Ya estás autenticado.')
  //   return
  // }
  // // Verifica si el usuario ya tiene una cuenta de Google
  // if (req.user) {
  //   res.status(400).send('Ya tienes una cuenta de Google vinculada.')
  //   return
  // }
  // Genera la URL de autenticación de Google
  // Aquí deberías obtener el user_id desde tu sistema de autenticación
  const userId = req.user?.id
  if (!userId) {
    res.status(400).send('No se pudo obtener el ID de usuario.')
    return
  }
  const url = getGoogleAuthUrl()
  res.redirect(url)
})

// Callback de Google
router.get(
  '/auth/google/callback',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response) => {
    // Verifica si el usuario está autenticado
    if (!req.user) {
      res.status(401).send('Unauthorized')
      return
    }
    const { code } = req.query

    if (!code || typeof code !== 'string') {
      res.status(400).send('No code provided')
      return
    }

    try {
      const tokens = await getTokensFromCode(code)

      // Aquí deberías obtener el user_id desde tu sistema de autenticación
      const userId = req.user.id
      // Verifica si el usuario ya tiene una cuenta de Google
      const existingAccount = await UserAccount.findOne({
        where: {
          user_id: userId,
          provider: 'google',
        },
      })
      if (existingAccount) {
        res.status(400).send('Ya tienes una cuenta de Google vinculada.')
        return
      }

      await UserAccount.create({
        user_id: userId,
        provider: 'google',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      })

      res.send('Autenticación completada correctamente.')
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  },
)

export { router as googleAuthRouter }
