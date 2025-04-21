// src/middlewares/auth.middleware.js
import jwt from 'jsonwebtoken'

import { Request, Response, NextFunction } from 'express'
import { User } from '../models/user.model.js'
import { UserAttributes } from '../types/user.types.js'

export const authenticateToken = async (
  req: Request & UserAttributes,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.sendStatus(401)
  }
}
