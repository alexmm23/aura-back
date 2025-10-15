import Stripe from 'stripe'
import express from 'express'
import env from '@/config/enviroment'
import { Router, Request, Response } from 'express'
import { authenticateToken } from '@/middlewares/auth.middleware'
import { confirmPayment, sendManualPaymentConfirmation } from '@/services/stripe.service'
import { User } from '@/models/user.model'
import { UserAttributes } from '@/types/user.types'
import stripe from 'stripe'

const router = Router()


router.post('/webhook', 
  express.raw({ type: 'application/json' }), 
  async (req: Request, res: Response): Promise<void> => {
    const sig = req.headers['stripe-signature'] as string;
    
    if (!sig) {
      res.status(400).json({ error: 'No Stripe signature found' });
      return;
    }

    let event: Stripe.Event;
    
    try {
      // Verificar que la petición viene de Stripe usando la firma
      event = stripe.webhooks.constructEvent(
        req.body, 
        sig, 
        process.env.STRIPE_WEBHOOK_SECRET as string
      );
    } catch (err: any) {
      console.error(`⚠️ Error de webhook: ${err.message}`);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    // Manejar diferentes tipos de eventos
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log(`✅ Pago exitoso recibido por webhook: ${paymentIntent.id}`);
        
        // TODO: Actualizar base de datos, marcar usuario como premium, etc.
        await handleSuccessfulPayment(paymentIntent);
        break;
        
      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object as Stripe.PaymentIntent;
        console.log(`❌ Pago fallido: ${failedPayment.id}`);
        // TODO: Manejar pagos fallidos
        break;
        
      // Otros eventos que podrían interesarte
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`Subscription event: ${event.type}, ID: ${subscription.id}`);
        // TODO: Manejar eventos de suscripción
        break;
        
      default:
        console.log(`Evento no manejado: ${event.type}`);
    }

    // Responder a Stripe que recibimos el evento correctamente
    res.json({ received: true });
  }
);

// Función para manejar pagos exitosos
async function handleSuccessfulPayment(paymentIntent: Stripe.PaymentIntent) {
  try {
    // Verificar si existe userId en metadata
    if (paymentIntent.metadata?.userId) {
      const userId = paymentIntent.metadata.userId;
      console.log(`🔄 Actualizando suscripción para usuario ${userId}...`);
      
      // Calcular fechas de inicio y fin de suscripción (1 mes de duración)
      const subscriptionStart = new Date();
      const subscriptionEnd = new Date();
      subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1); // Añadir 1 mes
      
      // Actualizar usuario con datos de suscripción
      const updateResult = await User.update(
        {
          subscription_status: 'active',
          subscription_type: 'premium', // O el tipo que corresponda
          subscription_start: subscriptionStart,
          subscription_end: subscriptionEnd
        }, 
        { 
          where: { id: userId } 
        }
      );
      
      if (updateResult[0] > 0) {
        console.log(`✅ Usuario ${userId} actualizado a premium correctamente`);
        console.log(`📅 Suscripción activa desde ${subscriptionStart.toISOString()} hasta ${subscriptionEnd.toISOString()}`);
      } else {
        console.log(`⚠️ Usuario ${userId} no encontrado o no actualizado`);
      }
    } else {
      console.log(`⚠️ No se encontró userId en los metadatos del pago ${paymentIntent.id}`);
    }
  } catch (error) {
    console.error('❌ Error al procesar pago exitoso:', error);
  }
}

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
    const paymentIntent = await confirmPayment(paymentMethodId, emailToUse, userId)

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


