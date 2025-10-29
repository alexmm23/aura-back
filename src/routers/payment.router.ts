import Stripe from 'stripe'
import express from 'express'
import env from '@/config/enviroment'
import { Router, Request, Response } from 'express'
import { authenticateToken } from '@/middlewares/auth.middleware'
import { confirmPayment, sendManualPaymentConfirmation } from '@/services/stripe.service'
import { User } from '@/models/user.model'
import { UserAttributes } from '@/types/user.types'

// Crear instancia de Stripe correctamente
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20' as Stripe.LatestApiVersion,
})

const router = Router()


// GET /payments/subscription-status - Verificar estado de suscripción del usuario
router.get('/subscription-status', authenticateToken, async (req: Request & { user?: UserAttributes }, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id

    if (!userId) {
      res.status(401).json({ 
        success: false,
        error: 'User not authenticated' 
      })
      return
    }

    // Buscar usuario con datos de suscripción
    const user = await User.findByPk(userId, {
      attributes: [
        'id', 
        'email', 
        'name', 
        'lastname',
        'subscription_status',
        'subscription_type', 
        'subscription_start',
        'subscription_end'
      ]
    })

    if (!user) {
      res.status(404).json({ 
        success: false,
        error: 'User not found' 
      })
      return
    }

    const subscriptionStatus = user.getDataValue('subscription_status')
    const subscriptionEnd = user.getDataValue('subscription_end')
    const now = new Date()

    // Verificar si la suscripción está activa y no ha expirado
    const hasActiveSubscription = subscriptionStatus === 'active' && 
                                 subscriptionEnd && 
                                 new Date(subscriptionEnd) > now

    res.json({
      success: true,
      hasActiveSubscription,
      subscriptionData: {
        status: subscriptionStatus,
        type: user.getDataValue('subscription_type'),
        startDate: user.getDataValue('subscription_start'),
        endDate: subscriptionEnd,
        isExpired: subscriptionEnd ? new Date(subscriptionEnd) <= now : false,
        daysRemaining: subscriptionEnd ? Math.ceil((new Date(subscriptionEnd).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0
      },
      userData: {
        name: user.getDataValue('name'),
        lastname: user.getDataValue('lastname'),
        email: user.getDataValue('email')
      }
    })

  } catch (error: any) {
    console.error('❌ Error checking subscription status:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

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
        await handleSuccessfulPayment(paymentIntent);
        break;
        
      case 'checkout.session.completed':
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        console.log(`✅ Checkout session completed: ${checkoutSession.id}`);
        
        // Si el pago fue exitoso, procesar
        if (checkoutSession.payment_status === 'paid') {
          // Obtener el PaymentIntent asociado
          if (checkoutSession.payment_intent) {
            const paymentIntentId = typeof checkoutSession.payment_intent === 'string' 
              ? checkoutSession.payment_intent 
              : checkoutSession.payment_intent.id;
              
            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
            
            // Extraer userId y email directamente de la sesión de checkout
            const userId = checkoutSession.metadata?.userId;
            const userEmail = checkoutSession.metadata?.userEmail || checkoutSession.customer_email || '';
            
            console.log(`📋 Procesando checkout.session.completed con userId: ${userId}, email: ${userEmail}`);
            
            // Pasar los datos directamente a handleSuccessfulPayment
            await handleSuccessfulPayment(paymentIntent, userId, userEmail);
          }
        }
        break;
        
      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object as Stripe.PaymentIntent;
        console.log(`❌ Pago fallido: ${failedPayment.id}`);
        break;
        
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`Subscription event: ${event.type}, ID: ${subscription.id}`);
        break;
        
      default:
        console.log(`Evento no manejado: ${event.type}`);
    }

    // Responder a Stripe que recibimos el evento correctamente
    res.json({ received: true });
  }
);

// Función para manejar pagos exitosos - ahora acepta parámetros opcionales
async function handleSuccessfulPayment(
  paymentIntent: Stripe.PaymentIntent, 
  userIdOverride?: string, 
  userEmailOverride?: string
) {
  try {
    // Priorizar parámetros directos sobre metadata del paymentIntent
    const userId = userIdOverride || paymentIntent.metadata?.userId;
    const userEmail = userEmailOverride || paymentIntent.metadata?.userEmail;
    
    // Verificar si existe userId
    if (userId) {
      console.log(`🔄 Actualizando suscripción para usuario ${userId}...`);
      
      // Calcular fechas de inicio y fin de suscripción (1 mes de duración)
      const subscriptionStart = new Date();
      const subscriptionEnd = new Date();
      subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1); // Añadir 1 mes
      
      // Actualizar usuario con datos de suscripción
      const updateResult = await User.update(
        {
          subscription_status: 'active',
          subscription_type: 'premium',
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
        
        // Enviar email de confirmación si tenemos el email
        if (userEmail) {
          try {
            const paymentData = {
              amount: (paymentIntent.amount / 100).toFixed(2),
              currency: paymentIntent.currency.toUpperCase(),
              paymentId: paymentIntent.id,
              date: new Date().toISOString(),
              status: paymentIntent.status,
            };

            await sendManualPaymentConfirmation(userEmail, paymentData);
            console.log(`📧 Confirmation email sent to ${userEmail}`);
          } catch (emailError) {
            console.error('❌ Error sending confirmation email:', emailError);
          }
        }
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

    
    const user = await User.findByPk(userId, {
      attributes: ['id', 'email', 'name', 'lastname', 'subscription_status', 'subscription_end']
    })

    if (!user) {
      res.status(404).json({ 
        success: false,
        error: 'User not found' 
      })
      return
    }

    const subscriptionStatus = user.getDataValue('subscription_status')
    const subscriptionEnd = user.getDataValue('subscription_end')
    const now = new Date()

    // Verificar si ya tiene una suscripción activa
    const hasActiveSubscription = subscriptionStatus === 'active' && 
                                 subscriptionEnd && 
                                 new Date(subscriptionEnd) > now

    if (hasActiveSubscription) {
      res.status(409).json({ // 409 Conflict
        success: false,
        error: 'User already has an active subscription',
        message: 'Ya tienes una membresía activa. No puedes realizar otro pago.',
        subscriptionData: {
          status: subscriptionStatus,
          endDate: subscriptionEnd,
          daysRemaining: Math.ceil((new Date(subscriptionEnd).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        }
      })
      return
    }

    // Usar el email del formulario si está disponible, sino el del usuario
    let emailToUse = billingEmail || user.getDataValue('email')

    console.log(`💳 Processing payment for email: ${emailToUse}`)
    
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

// POST /payments/create-checkout-session - Crear sesión de checkout de Stripe
router.post('/create-checkout-session', authenticateToken, async (req: Request & { user?: UserAttributes }, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id

    if (!userId) {
      res.status(401).json({ 
        success: false,
        error: 'User not authenticated' 
      })
      return
    }

    console.log('🔍 Creating checkout session for user:', userId)

    // Verificar si el usuario ya tiene una suscripción activa
    const user = await User.findByPk(userId, {
      attributes: ['id', 'email', 'name', 'lastname', 'subscription_status', 'subscription_end']
    })

    if (!user) {
      res.status(404).json({ 
        success: false,
        error: 'User not found' 
      })
      return
    }

    const subscriptionStatus = user.getDataValue('subscription_status')
    const subscriptionEnd = user.getDataValue('subscription_end')
    const now = new Date()

    // Verificar si ya tiene una suscripción activa
    const hasActiveSubscription = subscriptionStatus === 'active' && 
                                 subscriptionEnd && 
                                 new Date(subscriptionEnd) > now

    if (hasActiveSubscription) {
      res.status(409).json({
        success: false,
        error: 'User already has an active subscription',
        message: 'Ya tienes una membresía activa. No puedes realizar otro pago.'
      })
      return
    }

    console.log('✅ User validation passed, creating Stripe session...')

    // Verificar y establecer URLs por defecto si no existen
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
    const successUrl = `${frontendUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${frontendUrl}/payment/cancel`

    console.log('🔗 Frontend URL:', frontendUrl)
    console.log('✅ Success URL:', successUrl)
    console.log('❌ Cancel URL:', cancelUrl)

    // Crear sesión de checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'mxn',
            product_data: {
              name: 'Membresía Premium Aura',
              description: 'Acceso completo a todas las funciones premium por 1 mes',
            },
            unit_amount: 9900, // $99.00 MXN en centavos
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: user.getDataValue('email'),
      metadata: {
        userId: userId.toString(),
        userEmail: user.getDataValue('email'),
      },
      // Asegurar que los metadatos también se copien al PaymentIntent creado por Checkout
      payment_intent_data: {
        metadata: {
          userId: userId.toString(),
          userEmail: user.getDataValue('email'),
        }
      }
    })

    console.log('✅ Checkout session created:', session.id)

    res.json({
      success: true,
      sessionId: session.id,
      url: session.url
    })

  } catch (error: any) {
    console.error('❌ Error creating checkout session:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

// GET /payments/checkout-success - Verificar éxito del checkout y actualizar membresía
router.get('/checkout-success', authenticateToken, async (req: Request & { user?: UserAttributes }, res: Response): Promise<void> => {
  try {
    const { session_id } = req.query
    const userId = req.user?.id

    if (!session_id || !userId) {
      res.status(400).json({
        success: false,
        error: 'Missing session_id or user authentication'
      })
      return
    }

    console.log(`🔍 Verificando checkout success para usuario ${userId} y sesión ${session_id}`)

    // Recuperar la sesión de checkout
    const session = await stripe.checkout.sessions.retrieve(session_id as string, {
      expand: ['payment_intent']
    })

    console.log(`📋 Session status: ${session.payment_status}`)
    console.log(`📋 Session metadata:`, session.metadata)

    if (session.payment_status === 'paid') {
      // Verificar que el userId coincida
      if (session.metadata?.userId === userId.toString()) {
        
        console.log(`✅ Pago confirmado para usuario ${userId}, actualizando membresía...`)
        
        // Verificar si el usuario ya tiene membresía activa
        const user = await User.findByPk(userId, {
          attributes: ['id', 'email', 'name', 'lastname', 'subscription_status', 'subscription_end']
        })

        if (!user) {
          res.status(404).json({
            success: false,
            error: 'User not found'
          })
          return
        }

        // Calcular fechas de inicio y fin de suscripción (1 mes de duración)
        const subscriptionStart = new Date()
        const subscriptionEnd = new Date()
        subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1) // Añadir 1 mes
        
        console.log(`📅 Actualizando suscripción: ${subscriptionStart.toISOString()} - ${subscriptionEnd.toISOString()}`)

        // Actualizar usuario con datos de suscripción
        const updateResult = await User.update(
          {
            subscription_status: 'active',
            subscription_type: 'premium',
            subscription_start: subscriptionStart,
            subscription_end: subscriptionEnd
          }, 
          { 
            where: { id: userId } 
          }
        )

        console.log(`📝 Update result:`, updateResult)

        if (updateResult[0] > 0) {
          console.log(`✅ Usuario ${userId} actualizado a premium correctamente`)

          // Obtener datos del payment intent para el email
          const paymentIntent = session.payment_intent as Stripe.PaymentIntent
          
          // Enviar email de confirmación
          try {
            const paymentData = {
              amount: (session.amount_total! / 100).toFixed(2), // amount_total ya incluye todos los costos
              currency: session.currency!.toUpperCase(),
              paymentId: paymentIntent.id,
              date: new Date().toISOString(),
              status: 'succeeded',
            }

            await sendManualPaymentConfirmation(user.getDataValue('email'), paymentData)
            console.log(`📧 Email de confirmación enviado a ${user.getDataValue('email')}`)
          } catch (emailError) {
            console.error('❌ Error enviando email de confirmación:', emailError)
          }

          // Verificar la actualización obteniendo el usuario actualizado
          const updatedUser = await User.findByPk(userId, {
            attributes: [
              'id', 
              'subscription_status', 
              'subscription_type', 
              'subscription_start', 
              'subscription_end'
            ]
          })

          res.json({
            success: true,
            message: 'Pago confirmado y membresía actualizada exitosamente',
            session: {
              id: session.id,
              payment_status: session.payment_status,
              amount_total: session.amount_total,
              currency: session.currency,
            },
            subscription: {
              status: updatedUser?.getDataValue('subscription_status'),
              type: updatedUser?.getDataValue('subscription_type'),
              startDate: updatedUser?.getDataValue('subscription_start'),
              endDate: updatedUser?.getDataValue('subscription_end')
            }
          })
        } else {
          console.log(`⚠️ Usuario ${userId} no fue actualizado`)
          res.status(500).json({
            success: false,
            error: 'Failed to update user subscription'
          })
        }
      } else {
        console.log(`⚠️ Session userId mismatch: ${session.metadata?.userId} vs ${userId}`)
        res.status(403).json({
          success: false,
          error: 'Session does not belong to authenticated user'
        })
      }
    } else {
      console.log(`⚠️ Payment not completed: ${session.payment_status}`)
      res.status(400).json({
        success: false,
        error: 'Payment not completed',
        payment_status: session.payment_status
      })
    }

  } catch (error: any) {
    console.error('❌ Error verifying checkout success:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

// POST /payments/verify-payment - Verificar manualmente el estado del pago
router.post('/verify-payment', authenticateToken, async (req: Request & { user?: UserAttributes }, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.body
    const userId = req.user?.id

    if (!sessionId || !userId) {
      res.status(400).json({
        success: false,
        error: 'Missing sessionId or user authentication'
      })
      return
    }

    console.log(`🔍 Verificación manual de pago para usuario ${userId}`)

    // Recuperar la sesión de checkout
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent']
    })

    if (session.payment_status === 'paid' && session.metadata?.userId === userId.toString()) {
      
      // Verificar si ya fue procesado
      const user = await User.findByPk(userId, {
        attributes: ['subscription_status', 'subscription_end']
      })

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found'
        })
        return
      }

      const subscriptionStatus = user.getDataValue('subscription_status')
      const subscriptionEnd = user.getDataValue('subscription_end')
      const now = new Date()

      // Verificar si ya tiene una suscripción activa
      const hasActiveSubscription = subscriptionStatus === 'active' && 
                                   subscriptionEnd && 
                                   new Date(subscriptionEnd) > now

      if (hasActiveSubscription) {
        res.json({
          success: true,
          message: 'El usuario ya tiene una membresía activa',
          alreadyProcessed: true
        })
        return
      }

      // Procesar la actualización de membresía
      const subscriptionStart = new Date()
      const newSubscriptionEnd = new Date()
      newSubscriptionEnd.setMonth(newSubscriptionEnd.getMonth() + 1)

      const updateResult = await User.update(
        {
          subscription_status: 'active',
          subscription_type: 'premium',
          subscription_start: subscriptionStart,
          subscription_end: newSubscriptionEnd
        }, 
        { 
          where: { id: userId } 
        }
      )

      if (updateResult[0] > 0) {
        console.log(`✅ Membresía actualizada para usuario ${userId}`)
        
        res.json({
          success: true,
          message: 'Membresía actualizada exitosamente',
          processed: true,
          subscription: {
            status: 'active',
            type: 'premium',
            startDate: subscriptionStart,
            endDate: newSubscriptionEnd
          }
        })
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to update membership'
        })
      }
    } else {
      res.status(400).json({
        success: false,
        error: 'Payment not completed or invalid session',
        payment_status: session.payment_status
      })
    }

  } catch (error: any) {
    console.error('❌ Error verifying payment:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

export { router as paymentRouter }


