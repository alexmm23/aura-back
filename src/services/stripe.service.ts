import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20' as Stripe.LatestApiVersion
})

/**
 * Confirma un pago de $99.00 MXN con un paymentMethodId
 */
export const confirmPayment = async (paymentMethodId: string) => {
  const amount = 9900; // $99 MXN en centavos
  const currency = 'mxn';

  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency,
    payment_method: paymentMethodId,
    confirm: true,
    automatic_payment_methods: {
      enabled: true,
      allow_redirects: 'never'
    }
  });

  return paymentIntent;
};

