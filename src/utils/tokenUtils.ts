import crypto from 'crypto'

export const generateSecureToken = (): string => {
  return crypto.randomBytes(32).toString('hex')
}

export const isTokenExpired = (expiresAt: Date): boolean => {
  return new Date() > expiresAt
}