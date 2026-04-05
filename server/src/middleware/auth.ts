import { Response, Request, NextFunction } from 'express'
import { verifyToken } from '../lib/auth.js'
import { prisma } from '../lib/prisma.js'

export interface AuthRequest extends Request {
  user?: {
    id: string
    firstName: string
    lastName: string
    email: string
  } | null
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.['auth-token']
    if (!token) {
      req.user = null
      return next()
    }

    const payload = verifyToken(token)
    if (!payload) {
      req.user = null
      return next()
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    })

    req.user = user
    next()
  } catch (error) {
    console.error('Auth middleware error:', error)
    req.user = null
    next()
  }
}