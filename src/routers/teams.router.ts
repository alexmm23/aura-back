import { Router } from 'express'
import { getUserTeams } from '../services/teams.service'
import { authenticateToken } from '@/middlewares/auth.middleware'

const router = Router()
router.use(authenticateToken)

router.get('/teams', async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader) {
    res.status(401).json({ error: 'Missing Authorization header' })
    return
  }
  const accessToken = authHeader.replace('Bearer ', '').trim()
  try {
    const teams = await getUserTeams(accessToken)
    res.json({ teams })
  } catch (error: any) {
    console.error('Error in /api/teams:', error)
    res.status(500).json({ error: error.message || 'UnknownError' })
  }
})

export default router
