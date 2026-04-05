import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { hashPassword, verifyPassword, generateToken, setAuthCookie, removeAuthCookie } from '../lib/auth.js'
import { authenticate, AuthRequest } from '../middleware/auth.js'

const router = Router()

const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

const loginSchema = z.object({
  email: z.email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

router.post('/register', async (req: AuthRequest, res: Response) => {
  try {
    const validatedData = registerSchema.parse(req.body)

    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    })

    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' })
    }

    const hashedPassword = await hashPassword(validatedData.password)

    const user = await prisma.user.create({
      data: {
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        email: validatedData.email,
        password: hashedPassword,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    })

    const token = generateToken(user.id)
    setAuthCookie(res, token)

    res.json({ user })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message })
    }
    console.error('Register error:', error)
    res.status(500).json({ error: 'Something went wrong' })
  }
})

router.post('/login', async (req: AuthRequest, res: Response) => {
  try {
    const validatedData = loginSchema.parse(req.body)

    const user = await prisma.user.findUnique({
      where: { email: validatedData.email },
    })

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const isValidPassword = await verifyPassword(validatedData.password, user.password)

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const token = generateToken(user.id)
    setAuthCookie(res, token)

    res.json({
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message })
    }
    console.error('Login error:', error)
    res.status(500).json({ error: 'Something went wrong' })
  }
})

router.post('/logout', async (req: AuthRequest, res: Response) => {
  removeAuthCookie(res)
  res.json({ success: true })
})

router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ user: null })
  }
  res.json({ user: req.user })
})

export default router