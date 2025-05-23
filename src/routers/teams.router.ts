import { Router } from 'express'
import { getUserTeams } from '../services/teams.service'


const router = Router()

router.get('/teams', async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' })
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