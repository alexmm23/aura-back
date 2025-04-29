import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

export const sendEmail = async (to: string, subject: string, html: string) => {
  try {
    const response = await resend.emails.send({
      from: 'AURA <onboarding@resend.dev>',
      to: to,
      subject: subject,
      html: html,
    })
    return response
  } catch (error) {
    console.error('Error sending email:', error)
    throw new Error('Error sending email')
  }
}
