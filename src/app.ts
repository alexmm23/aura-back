import express from 'express'
import cookieParser from 'cookie-parser'
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
import { paymentRouter } from './routers/payment.router.js'
import { forumRouter } from './routers/forum.router.js'
import { reminderRouter } from './routers/reminder.router.js'
import { chatRouter } from './routers/chat.router.js'

// Importar modelos con asociaciones configuradas
import './models/index.js'

const app = express()
const { API_BASE_PATH, CORS_ORIGIN, PORT } = env
app.use('/api/payment', paymentRouter)
app.use('/payment', paymentRouter)

app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))
app.use(cookieParser())
app.use(
  cors({
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
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
  { path: `${API_BASE_PATH}/student`, router: studentRouter },
  { path: `${API_BASE_PATH}/oauth`, router: oauthRouter },
  { path: `${API_BASE_PATH}/teams`, router: teamsRouter },
  { path: `${API_BASE_PATH}/notebook`, router: notebookRouter },
  { path: `${API_BASE_PATH}/note`, router: noteRouter },
  { path: `${API_BASE_PATH}/payments`, router: paymentRouter },
  { path: `${API_BASE_PATH}/forums`, router: forumRouter },
  { path: `${API_BASE_PATH}/reminders`, router: reminderRouter },
  { path: `${API_BASE_PATH}/chats`, router: chatRouter },
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
