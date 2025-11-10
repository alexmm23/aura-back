import { Router, Request, Response } from 'express'
import { authenticateToken } from '@/middlewares/auth.middleware'
import {
  getUserNotificationTokens,
  registerPushToken,
  sendNotificationToUser,
  unregisterPushToken,
} from '@/services/notification.service'
import { RegisterPushTokenRequest } from '@/types/notifications.types'
import { UserAttributes } from '@/types/user.types'

export const notificationRouter = Router()

notificationRouter.post(
  '/tokens',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response): Promise<void> => {
    try {
      const { user } = req

      if (!user?.id) {
        res.status(401).json({ success: false, error: 'Unauthorized' })
        return
      }

      const payload = req.body as RegisterPushTokenRequest
      const tokenRecord = await registerPushToken(user.id, payload)
      const tokenData =
        typeof (tokenRecord as any)?.toJSON === 'function'
          ? (tokenRecord as any).toJSON()
          : tokenRecord

      res.status(201).json({ success: true, data: tokenData })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      res.status(400).json({ success: false, error: message })
    }
  },
)

notificationRouter.get(
  '/tokens',
  authenticateToken,
  async (req: Request & { user?: UserAttributes }, res: Response): Promise<void> => {
    try {
      const { user } = req

      if (!user?.id) {
        res.status(401).json({ success: false, error: 'Unauthorized' })
        return
      }

      const tokensRaw = await getUserNotificationTokens(user.id)
      const tokens = tokensRaw.map((token: any) =>
        typeof token?.toJSON === 'function' ? token.toJSON() : token,
      )
      res.status(200).json({ success: true, data: tokens })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      res.status(500).json({ success: false, error: message })
    }
  },
)

notificationRouter.delete(
  '/tokens',
  authenticateToken,
  async (
    req: Request & { user?: UserAttributes; body?: { token?: string } },
    res: Response,
  ): Promise<void> => {
    try {
      const { user } = req

      if (!user?.id) {
        res.status(401).json({ success: false, error: 'Unauthorized' })
        return
      }

      const removed = await unregisterPushToken(req.body?.token ?? '', user.id)

      res.status(removed ? 200 : 404).json({ success: removed })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      res.status(500).json({ success: false, error: message })
    }
  },
)

notificationRouter.post(
  '/test',
  authenticateToken,
  async (
    req: Request & { user?: UserAttributes; body?: { title?: string; body?: string } },
    res: Response,
  ): Promise<void> => {
    try {
      const { user } = req

      if (!user?.id) {
        res.status(401).json({ success: false, error: 'Unauthorized' })
        return
      }

      const title = req.body?.title || 'Notificación de prueba'
      const body = req.body?.body || 'Esto es un mensaje de prueba.'

      const result = await sendNotificationToUser({
        userId: user.id,
        title,
        body,
        data: { type: 'test' },
      })

      res.status(200).json({ success: true, result })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      res.status(500).json({ success: false, error: message })
    }
  },
)

export default notificationRouter
