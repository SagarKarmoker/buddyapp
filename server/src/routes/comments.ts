import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authenticate, AuthRequest } from '../middleware/auth.js'

const router = Router()

const createCommentSchema = z.object({
  content: z.string().min(1, 'Comment content is required'),
  postId: z.string(),
})

router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const validatedData = createCommentSchema.parse(req.body)

    const post = await prisma.post.findUnique({
      where: { id: validatedData.postId },
    })

    if (!post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    if (post.visibility === 'PRIVATE' && post.authorId !== req.user.id) {
      return res.status(404).json({ error: 'Post not found' })
    }

    const comment = await prisma.comment.create({
      data: {
        content: validatedData.content,
        postId: validatedData.postId,
        authorId: req.user.id,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    res.json({ comment })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message })
    }
    console.error('Create comment error:', error)
    res.status(500).json({ error: 'Failed to create comment' })
  }
})

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { postId } = req.query

    if (!postId) {
      return res.status(400).json({ error: 'Post ID is required' })
    }

    const post = await prisma.post.findUnique({
      where: { id: postId as string },
      select: { id: true, visibility: true, authorId: true },
    })

    if (!post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    if (post.visibility === 'PRIVATE' && post.authorId !== req.user?.id) {
      return res.status(404).json({ error: 'Post not found' })
    }

    const comments = await prisma.comment.findMany({
      where: { postId: postId as string },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        commentLikes: { select: { userId: true } },
        replies: {
          include: {
            author: { select: { id: true, firstName: true, lastName: true } },
            replyLikes: { select: { userId: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const commentsWithLikes = comments.map((comment) => ({
      ...comment,
      likesCount: comment.commentLikes.length,
      isLiked: req.user ? comment.commentLikes.some((like) => like.userId === req.user!.id) : false,
      isAuthor: req.user ? comment.authorId === req.user.id : false,
      replies: comment.replies.map((reply) => ({
        ...reply,
        likesCount: reply.replyLikes.length,
        isLiked: req.user ? reply.replyLikes.some((like) => like.userId === req.user!.id) : false,
        isAuthor: req.user ? reply.authorId === req.user.id : false,
      })),
    }))

    res.json({ comments: commentsWithLikes })
  } catch (error) {
    console.error('Get comments error:', error)
    res.status(500).json({ error: 'Failed to fetch comments' })
  }
})

export default router