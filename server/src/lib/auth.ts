import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { Response } from 'express'

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production'
const COOKIE_NAME = 'auth-token'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string }
  } catch {
    return null
  }
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7 * 1000,
    path: '/',
  })
}

export function removeAuthCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    path: '/',
  })
}