import { Router, Request, Response } from 'express'
import jwt, { JwtPayload } from 'jsonwebtoken'
import env from '@/config/enviroment'
import { deleteUserAccount } from '@/services/user.service'
import { User } from '@/models/user.model'

const accountDeletionRouter = Router()

const escapeHtml = (value: unknown): string => {
  const stringValue = typeof value === 'string' ? value : `${value ?? ''}`
  return stringValue
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

interface DeletionTemplateOptions {
  token: string
  userId: number
  userName?: string | null
  userEmail?: string | null
  error?: string | null
  success?: string | null
}

const renderDeletionPage = ({
  token,
  userId,
  userName,
  userEmail,
  error,
  success,
}: DeletionTemplateOptions): string => {
  const safeToken = escapeHtml(token)
  const safeUserId = escapeHtml(userId)
  const safeName = escapeHtml(userName ?? '')
  const safeEmail = escapeHtml(userEmail ?? '')
  const disabledForm = Boolean(success)

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Eliminar cuenta AURA</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #f5f5f5; margin: 0; padding: 30px; }
    .container { max-width: 640px; margin: 0 auto; background: #fff; padding: 32px; border-radius: 16px; box-shadow: 0 20px 50px rgba(79,70,229,0.08); }
    h1 { margin-top: 0; color: #1f2937; font-size: 26px; }
    p { color: #4b5563; line-height: 1.6; }
    .highlight { background: #f0f9ff; border-left: 4px solid #2563eb; padding: 16px; border-radius: 8px; color: #1e3a8a; margin: 24px 0; }
    .error { background: #fef2f2; border-left: 4px solid #dc2626; color: #7f1d1d; }
    .success { background: #ecfdf5; border-left: 4px solid #10b981; color: #065f46; }
    form { margin-top: 24px; display: ${disabledForm ? 'none' : 'block'}; }
    label { display: block; margin-bottom: 8px; color: #374151; font-weight: 600; }
    input[type="email"], textarea { width: 100%; padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 16px; margin-bottom: 16px; }
    textarea { min-height: 100px; resize: vertical; }
    .checkbox { display: flex; align-items: flex-start; gap: 10px; margin: 16px 0; }
    .checkbox input { margin-top: 3px; }
    button { background: #dc2626; color: #fff; border: none; border-radius: 9999px; padding: 14px 28px; font-size: 16px; font-weight: 600; cursor: pointer; box-shadow: 0 10px 20px rgba(220,38,38,0.25); transition: transform 0.2s ease, box-shadow 0.2s ease; }
    button:hover { transform: translateY(-1px); box-shadow: 0 14px 30px rgba(220,38,38,0.35); }
    button:disabled { background: #9ca3af; cursor: not-allowed; box-shadow: none; }
    .footer { margin-top: 32px; font-size: 14px; color: #6b7280; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Eliminar cuenta de AURA</h1>
    <p>Hola ${safeName || 'usuario'}, estás a punto de eliminar tu cuenta en AURA. Esta acción es <strong>permanente</strong> y no podrás recuperar tus datos posteriormente.</p>

    ${error ? `<div class="highlight error">${escapeHtml(error)}</div>` : ''}
    ${success ? `<div class="highlight success">${escapeHtml(success)}</div>` : ''}

    <div class="highlight">
      <strong>Antes de continuar:</strong>
      <ul>
        <li>Se eliminará tu acceso inmediato a la plataforma.</li>
        <li>Se desvincularán tus cuentas conectadas (Google, Moodle, etc.).</li>
        <li>Perderás los recordatorios, notas y mensajes guardados.</li>
      </ul>
    </div>

    <form method="POST" action="/account/delete">
      <input type="hidden" name="token" value="${safeToken}">
      <input type="hidden" name="userId" value="${safeUserId}">

  <label for="email">Confirma tu correo electrónico</label>
  <input id="email" name="email" type="email" placeholder="tu@email.com" value="${safeEmail}" required ${disabledForm ? 'disabled' : ''}>

      <label for="reason">¿Nos cuentas por qué te vas? (opcional)</label>
      <textarea id="reason" name="reason" placeholder="Tu opinión nos ayuda a mejorar" ${disabledForm ? 'disabled' : ''}></textarea>

      <div class="checkbox">
        <input id="confirm" name="confirm" type="checkbox" value="yes" ${disabledForm ? 'disabled' : ''}>
        <label for="confirm">Entiendo que esta acción es definitiva y deseo eliminar mi cuenta.</label>
      </div>

      <button type="submit" ${disabledForm ? 'disabled' : ''}>Eliminar mi cuenta</button>
    </form>

    <p class="footer">Si necesitas ayuda, escríbenos a soporte@aurapp.com.mx</p>
  </div>
</body>
</html>`
}

const renderInfoPage = (): string => `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Cómo eliminar tu cuenta de AURA</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #f5f5f5; margin: 0; padding: 30px; }
    .container { max-width: 720px; margin: 0 auto; background: #fff; padding: 32px; border-radius: 16px; box-shadow: 0 20px 50px rgba(79,70,229,0.08); }
    h1 { margin-top: 0; color: #1f2937; font-size: 28px; }
    h2 { color: #2563eb; margin-top: 32px; font-size: 20px; }
    p { color: #4b5563; line-height: 1.7; }
    ol { color: #4b5563; line-height: 1.7; padding-left: 22px; }
    li { margin-bottom: 12px; }
    .highlight { background: #f0f9ff; border-left: 4px solid #2563eb; padding: 16px; border-radius: 8px; color: #1e3a8a; margin: 24px 0; }
    .contact { background: #ecfdf5; border-left: 4px solid #10b981; color: #065f46; padding: 16px; border-radius: 8px; margin: 32px 0; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Solicitar eliminación de tu cuenta AURA</h1>
    <p>Si deseas borrar tu cuenta y todos los datos asociados, sigue los pasos descritos a continuación. Esta guía aplica para usuarios de la aplicación móvil publicada en Google Play.</p>

    <h2>Paso a paso</h2>
    <ol>
      <li>Inicia sesión en la app AURA y ve a <strong>Perfil &gt; Configuración</strong>.</li>
      <li>Selecciona la opción <strong>"Eliminar mi cuenta"</strong> y solicita el enlace seguro.</li>
      <li>Recibirás un correo electrónico con un vínculo único que expira en 60 minutos.</li>
      <li>Abre el enlace desde tu dispositivo y confirma la eliminación escribiendo tu correo.</li>
      <li>Se cerrarán tus sesiones activas y se eliminarán tus datos personales de AURA.</li>
    </ol>

    <div class="highlight">
      <strong>Qué datos se eliminan:</strong>
      <ul>
        <li>Tu perfil y credenciales de acceso.</li>
        <li>Recordatorios, notas, chats y tokens de notificaciones.</li>
        <li>Cuentas conectadas (Google Classroom, Moodle u otras integraciones).</li>
      </ul>
      <p>Conservamos registros mínimos de auditoría y facturación cuando la ley lo exige (por ejemplo, recibos de pago o reportes fiscales vigentes).</p>
    </div>

    <div class="contact">
      <strong>¿Necesitas ayuda?</strong>
      <p>Escríbenos a <a href="mailto:soporte@aurapp.com.mx">soporte@aurapp.com.mx</a> si no puedes acceder al enlace o deseas asistencia adicional.</p>
    </div>

    <p>También puedes solicitar el enlace directo enviándonos un correo desde la dirección registrada en tu cuenta.</p>
  </div>
</body>
</html>`

const verifyDeletionToken = (token: string, userId: number): JwtPayload | null => {
  const secret = env.ACCOUNT_DELETION_SECRET || env.JWT_SECRET
  if (!secret) {
    return null
  }

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload | string
    if (typeof decoded === 'string') {
      return null
    }

    const tokenUserId = Number(decoded.userId ?? decoded.id)
    if (!Number.isInteger(tokenUserId) || tokenUserId !== userId) {
      return null
    }

    if (decoded.purpose && decoded.purpose !== 'account_deletion') {
      return null
    }

    return decoded
  } catch (error) {
    console.error('Invalid account deletion token:', error)
    return null
  }
}

accountDeletionRouter.get('/delete', async (req: Request, res: Response) => {
  const token = typeof req.query.token === 'string' ? req.query.token : ''
  const userIdParam = typeof req.query.userId === 'string' ? req.query.userId : ''
  const userId = Number(userIdParam)

  if (!token || !Number.isInteger(userId)) {
    res.status(400).send('Solicitud inválida: faltan parámetros necesarios.')
    return
  }

  const tokenPayload = verifyDeletionToken(token, userId)
  if (!tokenPayload) {
    res.status(400).send('El enlace para eliminar la cuenta no es válido o ha caducado.')
    return
  }

  const user = await User.findByPk(userId)
  const userName = user
    ? `${user.getDataValue('name') ?? ''} ${user.getDataValue('lastname') ?? ''}`.trim()
    : null
  const userEmail = user?.getDataValue('email') ?? null

  if (!user || user.getDataValue('deleted')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.status(200).send(
      renderDeletionPage({
        token,
        userId,
        userName,
        userEmail,
        success: 'Tu cuenta ya no está activa en AURA.',
      }),
    )
    return
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.status(200).send(
    renderDeletionPage({
      token,
      userId,
      userName,
      userEmail,
    }),
  )
})

accountDeletionRouter.get('/delete/info', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.status(200).send(renderInfoPage())
})

accountDeletionRouter.post('/delete', async (req: Request, res: Response) => {
  const token = typeof req.body.token === 'string' ? req.body.token : ''
  const userId = Number(req.body.userId)
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  const confirm = req.body.confirm === 'yes' || req.body.confirm === 'on'
  const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : ''

  res.setHeader('Content-Type', 'text/html; charset=utf-8')

  if (!token || !Number.isInteger(userId)) {
    res.status(400).send('Solicitud inválida: faltan parámetros necesarios.')
    return
  }

  const tokenPayload = verifyDeletionToken(token, userId)
  if (!tokenPayload) {
    res.status(400).send('El enlace para eliminar la cuenta no es válido o ha caducado.')
    return
  }

  const user = await User.findByPk(userId)
  const userName = user
    ? `${user.getDataValue('name') ?? ''} ${user.getDataValue('lastname') ?? ''}`.trim()
    : null
  const userEmail = user?.getDataValue('email') ?? null

  if (!user || user.getDataValue('deleted')) {
    res.status(200).send(
      renderDeletionPage({
        token,
        userId,
        userName,
        userEmail,
        success: 'Tu cuenta ya había sido eliminada previamente.',
      }),
    )
    return
  }

  if (!email || email !== userEmail?.toLowerCase()) {
    res.status(400).send(
      renderDeletionPage({
        token,
        userId,
        userName,
        userEmail,
        error: 'El correo proporcionado no coincide con el registrado en la cuenta.',
      }),
    )
    return
  }

  if (!confirm) {
    res.status(400).send(
      renderDeletionPage({
        token,
        userId,
        userName,
        userEmail,
        error: 'Debes confirmar que entiendes que la eliminación es definitiva.',
      }),
    )
    return
  }

  try {
    const deleted = await deleteUserAccount(userId)

    if (!deleted) {
      res.status(404).send(
        renderDeletionPage({
          token,
          userId,
          userName,
          userEmail,
          error: 'No encontramos una cuenta activa asociada a este enlace.',
        }),
      )
      return
    }

    if (reason) {
      console.log(`Usuario ${userId} solicitó eliminación de cuenta. Motivo: ${reason}`)
    }

    res.status(200).send(
      renderDeletionPage({
        token,
        userId,
        userName,
        userEmail,
        success: 'Tu cuenta fue eliminada correctamente. Lamentamos verte partir.',
      }),
    )
  } catch (error) {
    console.error('Error processing account deletion:', error)
    res.status(500).send(
      renderDeletionPage({
        token,
        userId,
        userName,
        userEmail,
        error: 'Ocurrió un error al eliminar tu cuenta. Inténtalo nuevamente más tarde.',
      }),
    )
  }
})

export default accountDeletionRouter
