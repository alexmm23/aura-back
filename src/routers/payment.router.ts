import { Router, Request, Response } from 'express'
import { authenticateToken } from '@/middlewares/auth.middleware'
import { confirmPayment, sendManualPaymentConfirmation } from '@/services/stripe.service'
import { User } from '@/models/user.model'
import { UserAttributes } from '@/types/user.types'

const router = Router()

// POST /payments/confirm - Confirmar pago y enviar email automáticamente
router.post('/confirm', authenticateToken, async (req: Request & { user?: UserAttributes }, res: Response): Promise<void> => {
  try {
    console.log('💳 Received payment confirmation request')
    
    const userId = req.user?.id
    const { paymentMethodId, billingEmail } = req.body // ✅ Obtener email del formulario
    
    if (!userId || !paymentMethodId) {
      res.status(400).json({ 
        success: false,
        error: 'Missing user or paymentMethodId' 
      })
      return
    }

    // Usar el email del formulario si está disponible, sino el del usuario
    let emailToUse = billingEmail;
    
    if (!emailToUse) {
      // Solo si no viene email del formulario, obtener del usuario
      const user = await User.findByPk(userId, {
        attributes: ['id', 'email', 'name', 'lastname']
      })

      if (!user) {
        res.status(404).json({ 
          success: false,
          error: 'User not found' 
        })
        return
      }

      emailToUse = user.getDataValue('email')
    }

    console.log(`💳 Processing payment for email: ${emailToUse}`)

    // Confirmar pago (esto automáticamente enviará el email si es exitoso)
    const paymentIntent = await confirmPayment(paymentMethodId, emailToUse)

    if (paymentIntent.status === 'succeeded') {
      console.log('✅ Payment confirmed successfully')
      
      res.json({ 
        success: true, 
        paymentIntent: {
          id: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status
        },
        message: `Pago confirmado y email enviado a ${emailToUse}`
      })
    } else {
      console.log(`⚠️ Payment status: ${paymentIntent.status}`)
      res.json({ 
        success: false, 
        error: `Payment status: ${paymentIntent.status}`,
        paymentIntent: {
          id: paymentIntent.id,
          status: paymentIntent.status
        }
      })
    }
  } catch (error: any) {
    console.error('❌ Payment confirmation error:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

// POST /payments/send-confirmation - Enviar email de confirmación manualmente
router.post('/send-confirmation', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, paymentData } = req.body

    if (!email || !paymentData) {
      res.status(400).json({ 
        success: false, 
        message: 'Email y datos de pago son requeridos' 
      })
      return
    }

    console.log(`📧 Manual payment confirmation request for: ${email}`)

    const result = await sendManualPaymentConfirmation(email, paymentData)
    
    res.json(result)
  } catch (error: any) {
    console.error('❌ Manual payment confirmation error:', error)
    res.status(500).json({ 
      success: false, 
      message: error.message
    })
  }
})

export { router as paymentRouter }


