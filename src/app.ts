import express from 'express'
import cookieParser from 'cookie-parser'
import cron from 'node-cron'
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
import { auraAiRouter } from './routers/auraAi.router.js'
import path from 'path'

// Importar modelos con asociaciones configuradas
import './models/index.js'
import { checkAndSendPendingReminders } from '@/services/reminder.service'

const app = express()
const { API_BASE_PATH, CORS_ORIGIN, PORT } = env
//app.use('/api/payment', paymentRouter)
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

// Middleware para servir archivos estáticos con encabezados CORS
app.use(
  '/storage',
  (req, res, next) => {
    res.header('Access-Control-Allow-Origin', CORS_ORIGIN)
    res.header('Access-Control-Allow-Methods', 'GET')
    res.header('Cross-Origin-Resource-Policy', 'cross-origin')
    next()
  },
  express.static(path.join(process.cwd(), 'storage')),
)

app.use('/payment', paymentRouter)

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
  { path: `${API_BASE_PATH}/auraai`, router: auraAiRouter },
]

routes.forEach(({ path, router }) => {
  console.log(`📍 Registering route: ${path}`)
  app.use(path, router)
})

console.log('🚀 All routes registered successfully')

app.get('/', (req, res) => {
  res.send('Hello World!')
})

// Health check endpoint para Railway
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'aura-backend',
  })
})
let isCheckingReminders = false
let lastCheckTimestamp = 0

async function executeReminderCheck(source: string) {
  const now = Date.now()
  const timeSinceLastCheck = now - lastCheckTimestamp

  // Si ya se está ejecutando, saltar
  if (isCheckingReminders) {
    console.log(`⏭️ Skipping ${source} check - already running`)
    return { skipped: true, reason: 'already_running' }
  }

  // Si se ejecutó hace menos de 30 segundos, saltar (evita duplicados)
  if (timeSinceLastCheck < 30000) {
    console.log(`⏭️ Skipping ${source} check - executed ${Math.round(timeSinceLastCheck / 1000)}s ago`)
    return { skipped: true, reason: 'too_soon' }
  }

  // Ejecutar la verificación
  isCheckingReminders = true
  lastCheckTimestamp = now

  try {
    console.log(`⏰ [${source}] Running reminder check...`)
    await checkAndSendPendingReminders()
    console.log(`✅ [${source}] Reminder check completed successfully`)
    return { success: true }
  } catch (error: any) {
    console.error(`❌ [${source}] Error in reminder check:`, error)
    throw error
  } finally {
    isCheckingReminders = false
  }
}

// Endpoint para cron externo (cron-job.org)
app.post('/cron/check-reminders', async (req, res) => {
  try {
    const result = await executeReminderCheck('EXTERNAL')
    
    if (result.skipped) {
        res.status(200).json({
          success: true,
          skipped: true,
          reason: result.reason,
          message: 'Check skipped - already processed recently',
          timestamp: new Date().toISOString(),
      })
      return
    }

    res.status(200).json({
      success: true,
      message: 'Pending reminders checked successfully',
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('❌ Error in external cron:', error)
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    })
  }
})

// ==================== CRON JOB INTERNO ====================
// Ejecuta cada minuto para revisar recordatorios pendientes

cron.schedule('* * * * *', async () => {
  try {
    await executeReminderCheck('INTERNAL')
  } catch (error: any) {
    // Error ya logueado en executeReminderCheck
  }
})

console.log('✅ Internal cron job scheduled to run every minute')

// ==================== KEEPALIVE (para evitar sleep) ====================
// Self-ping cada 10 minutos para mantener la app activa en Railway

const RAILWAY_URL = process.env.RAILWAY_PUBLIC_DOMAIN 
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : null

if (RAILWAY_URL) {
  cron.schedule('*/10 * * * *', async () => {
    try {
      const response = await fetch(`${RAILWAY_URL}/health`)
      console.log('🏓 Keepalive ping successful:', response.status)
    } catch (error) {
      console.log('⚠️ Keepalive ping failed (not critical):', error)
    }
  })
  console.log('🏓 Keepalive ping scheduled every 10 minutes')
}

console.log('🔄 Hybrid cron system active: Internal + External backup ready')

export default app