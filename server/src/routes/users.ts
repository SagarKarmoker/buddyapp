import { Router, Response } from 'express'
import { prisma } from '../lib/prisma.js'
import { authenticate, AuthRequest } from '../middleware/auth.js'

const router = Router()

/** List other registered users (for suggestions / sidebar). Excludes current user. */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const users = await prisma.user.findMany({
      where: { id: { not: req.user.id } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    res.json({ users })
  } catch (error) {
    console.error('List users error:', error)
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})

export default router
