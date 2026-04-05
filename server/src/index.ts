import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import authRoutes from './routes/auth.js'
import postsRoutes from './routes/posts.js'
import commentsRoutes from './routes/comments.js'
import repliesRoutes from './routes/replies.js'
import likesRoutes from './routes/likes.js'
import usersRoutes from './routes/users.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(cookieParser())

// Serve uploaded files
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
app.use('/uploads', express.static(join(__dirname, '../uploads')))

app.use('/api/auth', authRoutes)
app.use('/api/posts', postsRoutes)
app.use('/api/comments', commentsRoutes)
app.use('/api/replies', repliesRoutes)
app.use('/api/likes', likesRoutes)
app.use('/api/users', usersRoutes)

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})