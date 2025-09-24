import { User } from '@/models/user.model'
import { generateSecureToken } from '@/utils/tokenUtils'
import { sendEmail } from '@/services/email.service'
import env from '@/config/enviroment'
import { hashPassword } from '@/services/user.service'

export const initiatePasswordReset = async (email: string) => {
  
  // Buscar usuario por email
  const user = await User.findOne({ where: { email, deleted: false } })
  
  if (!user) {
    throw new Error('If this email exists, a reset link has been sent')
  }

  // Generar nuevo token y fecha de expiración (10 minutos)
  const resetToken = generateSecureToken()
  const tokenExpires = new Date(Date.now() + 10 * 60 * 1000)

  // Actualizar usuario con el nuevo token
  try {
    const updateResult = await User.update({
      reset_password_token: resetToken,
      reset_password_expires: tokenExpires
    }, {
      where: { id: user.id }
    })
    
    // Verificar que se guardó
    const updatedUser = await User.findOne({ where: { id: user.id } });
    
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    throw error;
  }

  // Crear múltiples enlaces para diferentes plataformas
  const webLink = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`
  const mobileLink = `aura:/reset-password?token=${resetToken}`
  const universalLink = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`
  console.log('🔗 Enlace generado:', webLink);

  // HTML del email con múltiples opciones
  const emailHTML = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #333; margin-bottom: 10px;">AURA</h1>
        <h2 style="color: #666; font-weight: normal;">Restablecer Contraseña</h2>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 30px;">
        <p style="font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
          Hola <strong>${user.name}</strong>,
        </p>
        <p style="font-size: 16px; line-height: 1.5; margin-bottom: 25px;">
          Recibimos una solicitud para restablecer la contraseña de tu cuenta. 
          Haz clic en el siguiente botón para continuar:
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${universalLink}" 
             style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                    color: white; padding: 15px 30px; text-decoration: none; 
                    border-radius: 25px; display: inline-block; font-weight: bold;
                    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);">
            🔑 Restablecer Contraseña
          </a>
        </div>

        <!-- Opciones adicionales para diferentes dispositivos -->
        <div style="margin: 20px 0; padding: 15px; background-color: #f0f0f0; border-radius: 8px;">
          <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">
            <strong>¿No funciona el botón principal?</strong> Prueba estas opciones:
          </p>
          <p style="margin: 5px 0; font-size: 13px;">
            📱 <strong>Para móvil:</strong> 
            <a href="${mobileLink}" style="color: #667eea;">Abrir en la app</a>
          </p>
          <p style="margin: 5px 0; font-size: 13px;">
            💻 <strong>Para navegador:</strong> 
            <a href="${webLink}" style="color: #667eea;">Abrir en web</a>
          </p>
        </div>
      </div>

      <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
        <p style="margin: 0; color: #856404; font-size: 14px;">
          ⚠️ <strong>Importante:</strong> Este enlace expirará en <strong>10 minutos</strong>. 
          Si no solicitaste este cambio, puedes ignorar este email de forma segura.
        </p>
      </div>

      <details style="margin-bottom: 20px;">
        <summary style="cursor: pointer; color: #666; font-size: 14px;">
          ¿Problemas con los enlaces? Haz clic aquí
        </summary>
        <p style="color: #666; font-size: 12px; margin-top: 10px; word-break: break-all;">
          Copia y pega uno de estos enlaces en tu dispositivo:<br><br>
          <strong>Web:</strong><br>
          <code style="background-color: #f4f4f4; padding: 2px 5px; border-radius: 3px; font-size: 11px;">
            ${webLink}
          </code><br><br>
          <strong>Móvil:</strong><br>
          <code style="background-color: #f4f4f4; padding: 2px 5px; border-radius: 3px; font-size: 11px;">
            ${mobileLink}
          </code>
        </p>
      </details>

      <hr style="border: none; height: 1px; background-color: #eee; margin: 30px 0;">
      
      <div style="text-align: center;">
        <p style="color: #999; font-size: 12px; margin: 0;">
          Este email fue enviado por AURA - Sistema de gestión
        </p>
      </div>
    </div>
  `

  // Enviar email
  await sendEmail(
    email,
    'Restablecer tu contraseña - AURA',
    emailHTML
  )

  return { 
    message: 'Reset link sent successfully',
    // Para desarrollo, puedes descomentar la siguiente línea
    // webLink,
    // mobileLink
  }
}

export const resetPasswordWithToken = async (token: string, newPassword: string) => {

  // Buscar usuario con el token válido
  const user = await User.findOne({
    where: { 
        reset_password_token: token,
        deleted: false 
    },
    attributes: ['id', 'name', 'email', 'reset_password_expires', 'reset_password_token'] // Agregar reset_password_token aquí
    })

  console.log('Usuario encontrado:', user ? {
    id: user.id,
    name: user.name,
    email: user.email,
    token: user.reset_password_token,
    expires: user.reset_password_expires,
    tokensMatch: user.reset_password_token === token
  } : 'NO ENCONTRADO');

  if (!user) {
    throw new Error('Invalid reset token')
  }

   // Verificar si el token ha expirado
  const now = new Date();
  const isExpired = !user.reset_password_expires || now > user.reset_password_expires;
  
  console.log(' Verificación de tiempo:', {
    now: now.toISOString(),
    expires: user.reset_password_expires?.toISOString(),
    isExpired
  });

  if (isExpired) {
    throw new Error('Reset token has expired')
  }

  // Hash de la nueva contraseña
  const { hashPassword } = await import('@/services/user.service')
  const hashedPassword = await hashPassword(newPassword)

  // Actualizar contraseña del usuario y limpiar tokens de reset
  await User.update({
    password: hashedPassword,
    reset_password_token: null,
    reset_password_expires: null
  }, {
    where: { id: user.id }
  })

  return { 
    message: 'Password updated successfully',
    user: {
      id: user.id,
      name: user.name,
      email: user.email
    }
  }
}   