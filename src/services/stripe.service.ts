import Stripe from 'stripe'
import env from '@/config/enviroment'

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-04-10' as Stripe.LatestApiVersion,
});


export const createCheckoutSession = async (userId: number, priceId: string) => {
  return await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'subscription',
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    metadata: { userId: String(userId) },
    success_url: `${env.FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.FRONTEND_URL}/payment-cancel`,
  })
}