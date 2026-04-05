import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authenticate, AuthRequest } from '../middleware/auth.js'

const router = Router()

const createReplySchema = z.object({
  content: z.string().min(1, 'Reply content is required'),
  commentId: z.string(),
})

router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const validatedData = createReplySchema.parse(req.body)

    const comment = await prisma.comment.findUnique({
      where: { id: validatedData.commentId },
      include: { post: true },
    })

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' })
    }

    if (comment.post.visibility === 'PRIVATE' && comment.post.authorId !== req.user.id) {
      return res.status(404).json({ error: 'Comment not found' })
    }

    const reply = await prisma.reply.create({
      data: {
        content: validatedData.content,
        commentId: validatedData.commentId,
        authorId: req.user.id,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    res.json({ reply })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message })
    }
    console.error('Create reply error:', error)
    res.status(500).json({ error: 'Failed to create reply' })
  }
})

export default router