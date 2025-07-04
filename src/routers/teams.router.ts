import { Router } from 'express'
import { getUserTeams } from '../services/teams.service.js'
import { authenticateToken } from '@/middlewares/auth.middleware'
import { UserAccount } from '@/models/userAccount.model'

const router = Router()
router.use(authenticateToken)

router.get('/teams', async (req, res) => {
  const user = (req as any).user
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  // Buscar el access token de Teams en la base de datos
  const userAccount = await UserAccount.findOne({
    where: {
      user_id: user.id,
      platform: 'microsoft',
      deleted: false,
    },
  })
  if (!userAccount || !userAccount.access_token) {
    res.status(401).json({ error: 'No Microsoft Teams access token found' })
    return
  }
  try {
    const teams = await getUserTeams(userAccount.access_token)
    res.json({ teams })
  } catch (error: any) {
    console.error('Error in /api/teams:', error)
    res.status(500).json({ error: error.message || 'UnknownError' })
  }
})

export default router
