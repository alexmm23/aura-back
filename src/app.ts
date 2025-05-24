import express from 'express'
import { userRouter } from './routers/user.router.js'
import { authRouter } from './routers/auth.router.js'
import { googleAuthRouter } from './routers/googleAuth.router.js'
import cors from 'cors'
import { studentRouter } from './routers/student.router.js'
import env from './config/enviroment.js'
import  oauthRouter  from './routers/oauth.router'
import teamsRouter from './routers/teams.router'
const app = express()
const { API_BASE_PATH, CORS_ORIGIN, PORT } = env

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(
  cors({
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
)
// app.use(checkRole)
// app.use(errorHandler)
app.use(`${API_BASE_PATH}/users`, userRouter)
app.use(`${API_BASE_PATH}/auth`, authRouter)
app.use(API_BASE_PATH, googleAuthRouter)
app.use(`${API_BASE_PATH}/student`, studentRouter)
app.use('/api/auth', oauthRouter)
app.use('/api', teamsRouter)
app.get('/', (req, res) => {
  res.send('Hello World!')
})

export default app
