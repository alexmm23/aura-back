import { Router } from 'express'
import { authenticateToken } from '@/middlewares/auth.middleware'
import { createCheckoutSession } from '@/services/stripe.service'

const router = Router()

router.post('/create-checkout-session', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id
    const { priceId } = req.body
    if (!userId || !priceId) {
      return res.status(400).json({ error: 'Missing user or priceId' })
    }
    const session = await createCheckoutSession(userId, priceId)
    res.json({ url: session.url })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export { router as paymentRouter }
