import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authenticate, AuthRequest } from '../middleware/auth.js'

const router = Router()

const createPostSchema = z.object({
  content: z.string().optional(),
  image: z.string().optional(), // base64 image
  visibility: z.enum(['PUBLIC', 'PRIVATE']).default('PUBLIC'),
})

const updatePostSchema = z.object({
  content: z.string().optional(),
  imageUrl: z.string().url().optional().nullable(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).optional(),
})

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { page = '1', limit = '10' } = req.query
    const pageNum = parseInt(page as string)
    const limitNum = parseInt(limit as string)
    const skip = (pageNum - 1) * limitNum

    const where = req.user
      ? {
          OR: [
            { visibility: 'PUBLIC' },
            { authorId: req.user.id },
          ],
        }
      : { visibility: 'PUBLIC' }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          author: {
            select: { id: true, firstName: true, lastName: true },
          },
          postLikes: { 
            select: { id: true, userId: true, user: { select: { firstName: true, lastName: true } } } 
          },
          _count: { select: { comments: true, postLikes: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.post.count({ where }),
    ])

    const postsWithLikes = posts.map((post) => ({
      ...post,
      likesCount: post.postLikes.length,
      isLiked: req.user ? post.postLikes.some((like) => like.userId === req.user!.id) : false,
      isAuthor: req.user ? post.authorId === req.user.id : false,
      commentsCount: post._count.comments,
    }))

    res.json({
      posts: postsWithLikes,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    })
  } catch (error) {
    console.error('Get posts error:', error)
    res.status(500).json({ error: 'Failed to fetch posts' })
  }
})

router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const validatedData = createPostSchema.parse(req.body)

    let imageUrl = ''
    if (validatedData.image) {
      // Save base64 image to a file
      const base64Data = validatedData.image.replace(/^data:image\/\w+;base64,/, '')
      const imageBuffer = Buffer.from(base64Data, 'base64')
      const fileName = `post_${Date.now()}.png`
      const uploadsDir = './uploads'
      
      // Ensure uploads directory exists
      const fs = await import('fs')
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true })
      }
      
      const filePath = `${uploadsDir}/${fileName}`
      fs.writeFileSync(filePath, imageBuffer)
      imageUrl = `/uploads/${fileName}`
    }

    const post = await prisma.post.create({
      data: {
        content: validatedData.content || '',
        imageUrl: imageUrl,
        visibility: validatedData.visibility,
        authorId: req.user.id,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    res.json({ post })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message })
    }
    console.error('Create post error:', error)
    res.status(500).json({ error: 'Failed to create post' })
  }
})

router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const post = await prisma.post.findUnique({
      where: { id: id as string },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        postLikes: { select: { userId: true } },
        comments: {
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
        },
      },
    })

    if (!post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    if (post.visibility === 'PRIVATE' && post.authorId !== req.user?.id) {
      return res.status(404).json({ error: 'Post not found' })
    }

    const postWithLikes = {
      ...post,
      likesCount: post.postLikes.length,
      isLiked: req.user ? post.postLikes.some((like) => like.userId === req.user!.id) : false,
      isAuthor: req.user ? post.authorId === req.user.id : false,
      comments: post.comments.map((comment) => ({
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
      })),
    }

    res.json({ post: postWithLikes })
  } catch (error) {
    console.error('Get post error:', error)
    res.status(500).json({ error: 'Failed to fetch post' })
  }
})

router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { id } = req.params
    const validatedData = updatePostSchema.parse(req.body)

    const existingPost = await prisma.post.findUnique({ where: { id: id as string } })

    if (!existingPost) {
      return res.status(404).json({ error: 'Post not found' })
    }

    if (existingPost.authorId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const post = await prisma.post.update({
      where: { id: id as string },
      data: validatedData,
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    res.json({ post })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message })
    }
    console.error('Update post error:', error)
    res.status(500).json({ error: 'Failed to update post' })
  }
})

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { id } = req.params
    const post = await prisma.post.findUnique({ where: { id: id as string } })

    if (!post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    if (post.authorId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    await prisma.post.delete({ where: { id: id as string } })
    res.json({ success: true })
  } catch (error) {
    console.error('Delete post error:', error)
    res.status(500).json({ error: 'Failed to delete post' })
  }
})

export default router