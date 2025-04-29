import express from 'express'
import { userRouter } from './routers/user.router.js'
import cors from 'cors'
import dotenv from 'dotenv';
dotenv.config();
const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:8081',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
)
// app.use(checkRole)
// app.use(errorHandler)
app.use('/api/users', userRouter)
app.get('/', (req, res) => {
  res.send('Hello World!')
})
export default app
