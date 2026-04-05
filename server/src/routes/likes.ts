import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authenticate, AuthRequest } from '../middleware/auth.js'

const router = Router()

const toggleLikeSchema = z.object({
  postId: z.string().optional(),
  commentId: z.string().optional(),
  replyId: z.string().optional(),
})

router.post('/post', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { postId } = req.body

    if (!postId) {
      return res.status(400).json({ error: 'Post ID is required' })
    }

    const post = await prisma.post.findUnique({ where: { id: postId } })

    if (!post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    if (post.visibility === 'PRIVATE' && post.authorId !== req.user.id) {
      return res.status(404).json({ error: 'Post not found' })
    }

    const existingLike = await prisma.postLike.findUnique({
      where: { userId_postId: { userId: req.user.id, postId } },
    })

    if (existingLike) {
      await prisma.postLike.delete({ where: { id: existingLike.id } })
      return res.json({ liked: false })
    } else {
      await prisma.postLike.create({
        data: { userId: req.user.id, postId },
      })
      return res.json({ liked: true })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message })
    }
    console.error('Toggle post like error:', error)
    res.status(500).json({ error: 'Failed to toggle like' })
  }
})

router.post('/comment', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { commentId } = req.body

    if (!commentId) {
      return res.status(400).json({ error: 'Comment ID is required' })
    }

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: { post: { select: { visibility: true, authorId: true } } },
    })

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' })
    }

    if (comment.post.visibility === 'PRIVATE' && comment.post.authorId !== req.user.id) {
      return res.status(404).json({ error: 'Comment not found' })
    }

    const existingLike = await prisma.commentLike.findUnique({
      where: { userId_commentId: { userId: req.user.id, commentId } },
    })

    if (existingLike) {
      await prisma.commentLike.delete({ where: { id: existingLike.id } })
      return res.json({ liked: false })
    } else {
      await prisma.commentLike.create({
        data: { userId: req.user.id, commentId },
      })
      return res.json({ liked: true })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message })
    }
    console.error('Toggle comment like error:', error)
    res.status(500).json({ error: 'Failed to toggle like' })
  }
})

router.post('/reply', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { replyId } = req.body

    if (!replyId) {
      return res.status(400).json({ error: 'Reply ID is required' })
    }

    const reply = await prisma.reply.findUnique({
      where: { id: replyId },
      include: {
        comment: {
          include: { post: { select: { visibility: true, authorId: true } } },
        },
      },
    })

    if (!reply) {
      return res.status(404).json({ error: 'Reply not found' })
    }

    const post = reply.comment.post
    if (post.visibility === 'PRIVATE' && post.authorId !== req.user.id) {
      return res.status(404).json({ error: 'Reply not found' })
    }

    const existingLike = await prisma.replyLike.findUnique({
      where: { userId_replyId: { userId: req.user.id, replyId } },
    })

    if (existingLike) {
      await prisma.replyLike.delete({ where: { id: existingLike.id } })
      return res.json({ liked: false })
    } else {
      await prisma.replyLike.create({
        data: { userId: req.user.id, replyId },
      })
      return res.json({ liked: true })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message })
    }
    console.error('Toggle reply like error:', error)
    res.status(500).json({ error: 'Failed to toggle like' })
  }
})

router.get('/post/:postId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { postId } = req.params
    const post = await prisma.post.findUnique({
      where: { id: postId as string },
      select: { id: true, visibility: true, authorId: true },
    })

    if (!post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    if (post.visibility === 'PRIVATE' && post.authorId !== req.user.id) {
      return res.status(404).json({ error: 'Post not found' })
    }

    const likes = await prisma.postLike.findMany({
      where: { postId: postId as string },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    })
    res.json({ likes })
  } catch (error) {
    console.error('Get post likes error:', error)
    res.status(500).json({ error: 'Failed to fetch likes' })
  }
})

router.get('/comment/:commentId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { commentId } = req.params
    const comment = await prisma.comment.findUnique({
      where: { id: commentId as string },
      include: { post: { select: { visibility: true, authorId: true } } },
    })

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' })
    }

    if (comment.post.visibility === 'PRIVATE' && comment.post.authorId !== req.user.id) {
      return res.status(404).json({ error: 'Comment not found' })
    }

    const likes = await prisma.commentLike.findMany({
      where: { commentId: commentId as string },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    })
    res.json({ likes })
  } catch (error) {
    console.error('Get comment likes error:', error)
    res.status(500).json({ error: 'Failed to fetch likes' })
  }
})

router.get('/reply/:replyId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { replyId } = req.params
    const reply = await prisma.reply.findUnique({
      where: { id: replyId as string },
      include: {
        comment: {
          include: { post: { select: { visibility: true, authorId: true } } },
        },
      },
    })

    if (!reply) {
      return res.status(404).json({ error: 'Reply not found' })
    }

    const post = reply.comment.post
    if (post.visibility === 'PRIVATE' && post.authorId !== req.user.id) {
      return res.status(404).json({ error: 'Reply not found' })
    }

    const likes = await prisma.replyLike.findMany({
      where: { replyId: replyId as string },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    })
    res.json({ likes })
  } catch (error) {
    console.error('Get reply likes error:', error)
    res.status(500).json({ error: 'Failed to fetch likes' })
  }
})

export default router