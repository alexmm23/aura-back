import Stripe from 'stripe'
import { sendPaymentConfirmationEmail } from './reminder.service'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20' as Stripe.LatestApiVersion,
})

/**
 * Confirma un pago de $99.00 MXN con un paymentMethodId
 */
export const confirmPayment = async (paymentMethodId: string, userEmail?: string) => {
  try {
    const amount = 9900 // $99 MXN en centavos
    const currency = 'mxn'

    console.log('💳 Creating payment intent...')

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      payment_method: paymentMethodId,
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
    })

    console.log(`💳 Payment status: ${paymentIntent.status}`)

    // Si el pago fue exitoso Y tenemos email, enviar confirmación automáticamente
    if (paymentIntent.status === 'succeeded' && userEmail) {
      try {
        console.log('📧 Payment successful, sending confirmation email automatically...')

        const paymentData = {
          amount: (paymentIntent.amount / 100).toFixed(2), // Convertir centavos a pesos
          currency: paymentIntent.currency.toUpperCase(),
          paymentId: paymentIntent.id,
          date: new Date().toISOString(),
          status: paymentIntent.status,
        }

        await sendPaymentConfirmationEmail(userEmail, paymentData)
        console.log('✅ Payment confirmation email sent automatically')
      } catch (emailError: any) {
        console.error('❌ Error sending automatic payment confirmation email:', emailError.message)
        // No fallar el pago por error de email, solo loggear
      }
    }

    return paymentIntent
  } catch (error: any) {
    console.error('❌ Error confirming payment:', error)
    throw error
  }
}

/**
 * Enviar email de confirmación manualmente
 */
export const sendManualPaymentConfirmation = async (email: string, paymentData: any) => {
  try {
    console.log('📧 Sending manual payment confirmation to:', email)

    const success = await sendPaymentConfirmationEmail(email, paymentData)

    if (success) {
      console.log('✅ Manual payment confirmation sent successfully')
      return {
        success: true,
        message: 'Email de confirmación enviado exitosamente',
      }
    } else {
      throw new Error('Failed to send payment confirmation email')
    }
  } catch (error: any) {
    console.error('❌ Error in manual payment confirmation:', error)
    throw new Error('Error enviando email de confirmación: ' + error.message)
  }
}
