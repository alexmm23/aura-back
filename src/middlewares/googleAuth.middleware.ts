import { Request, Response, NextFunction } from 'express'

export const googleAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const { code, state } = req.query
  if (!code || typeof code !== 'string') {
    res.status(400).send('No code provided')
    return
  }
  if (!state || typeof state !== 'string') {
    res.status(400).send('No state provided')
    return
  }

  try {
    req.headers['authorization'] = `Bearer ${state}`
    next()
  } catch (error) {
    console.error('Error in Google Auth Middleware:', error)
    res.status(500).json({ error: 'Internal Server Error' })
  }
}
