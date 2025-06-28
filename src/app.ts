import express from 'express'
import { userRouter } from './routers/user.router.js'
import { authRouter } from './routers/auth.router.js'
import { googleAuthRouter } from './routers/googleAuth.router.js'
import cors from 'cors'
import { studentRouter } from './routers/student.router.js'
import env from './config/enviroment.js'
import oauthRouter from './routers/oauth.router.js'
import teamsRouter from './routers/teams.router.js'
import { notebookRouter } from './routers/notebook.router.js'
import { noteRouter } from './routers/note.router.js'
const app = express()
const { API_BASE_PATH, CORS_ORIGIN, PORT } = env

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use('/api/note', noteRouter)
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
const routes = [
  { path: `${API_BASE_PATH}/users`, router: userRouter },
  { path: `${API_BASE_PATH}/auth`, router: authRouter },
  { path: `${API_BASE_PATH}`, router: googleAuthRouter },
  { path: `${API_BASE_PATH}/students`, router: studentRouter },
  { path: `${API_BASE_PATH}/oauth`, router: oauthRouter },
  { path: `${API_BASE_PATH}/teams`, router: teamsRouter },
  { path: `${API_BASE_PATH}/notebook`, router: notebookRouter },
]

routes.forEach(({ path, router }) => {
  console.log(`📍 Registering route: ${path}`)
  app.use(path, router)
})

console.log('🚀 All routes registered successfully')

app.get('/', (req, res) => {
  res.send('Hello World!')
})

export default app
