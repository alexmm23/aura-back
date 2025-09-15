import { Router } from 'express'
import { authenticateToken } from '@/middlewares/auth.middleware'
import { confirmPayment } from '@/services/stripe.service'

const router = Router()

router.post('/payments/confirm', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id
    const { paymentMethodId } = req.body
    
    if (!userId || !paymentMethodId) {
      res.status(400).json({ error: 'Missing user or paymentMethodId' })
      return
    }

    const paymentIntent = await confirmPayment(paymentMethodId)

    if (paymentIntent.status === 'succeeded') {
      res.json({ success: true, paymentIntent })
    } else {
      res.json({ success: false, error: `Status: ${paymentIntent.status}` })
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export { router as paymentRouter }


