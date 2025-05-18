import { Router, Request, Response } from 'express'
import { authenticateToken } from '@/middlewares/auth.middleware'
import { getClassroomAssignments } from '@/services/classroom.service'
import { UserAttributes } from '@/types/user.types'
import { UserAccount } from '@/models/userAccount.model'
const studentRouter = Router()
studentRouter.use(authenticateToken)

studentRouter.get('/homework', async (req: Request & { user?: UserAttributes }, res: Response) => {
  try {
    const { user } = req
    const { access_token: accessToken } = await UserAccount.findOne({
      where: {
        user_id: user?.id,
        platform: 'google',
      },
    })
    console.log('Access Token:', accessToken)
    if (!accessToken) {
      res.status(401).json({ error: 'Unauthorized' })
    }
    const homework = await getClassroomAssignments(accessToken)
    res.status(200).json(homework)
  } catch (error) {
    console.error('Error fetching homework:', error)

    res.status(500).json({ error: 'Internal Server Error' })
  }
})
studentRouter.post('/homework', async (req, res) => {
  try {
    const { title, dueDate } = req.body
    // Simulate saving homework data
    const newHomework = {
      id: Math.floor(Math.random() * 1000), // Simulate an ID
      title,
      dueDate,
    }
    res.status(201).json(newHomework)
  } catch (error) {
    console.error('Error creating homework:', error)
    res.status(500).json({ error: 'Internal Server Error' })
  }
})

export { studentRouter }
