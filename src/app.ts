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

const app = express()
const { API_BASE_PATH, CORS_ORIGIN, PORT } = env
const allowedOrigins = [
  'https://my.aurapp.com.mx',
  'null', // para apps móviles
  'exp://127.0.0.1:19000', // para Expo Go en desarrollo
  'http://localhost:8081', // para pruebas locales web
];

app.use('/api/payment/webhook', express.raw({ type: 'application/json' }))
app.use('/payment/webhook', express.raw({ type: 'application/json' }))

app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))
app.use(cookieParser())
app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir requests sin origin (apps móviles, Postman, etc.)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error('No permitido por CORS'));
      }
    },
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
  { path: `${API_BASE_PATH}/payment`, router: paymentRouter },
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

// Endpoint para cron externo (cron-job.org)
app.post('/cron/check-reminders', async (req, res) => {
  try {
    console.log('🕐 External cron triggered - starting webhook...')
    
    // ✅ Responder INMEDIATAMENTE a cron-job.org
    res.status(200).json({
      success: true,
      message: 'Reminder check started in background',
      timestamp: new Date().toISOString(),
    })

    // ✅ Procesar en background (sin await)
    processRemindersBackground()
    
  } catch (error: any) {
    console.error('❌ Error starting cron:', error)
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    })
  }
})

// Función auxiliar para procesar en background
async function processRemindersBackground() {
  try {
    const startTime = Date.now()
    
    // ✅ CAMBIAR A check-pending en lugar de send-upcoming
    const webhookUrl = process.env.RAILWAY_PUBLIC_DOMAIN 
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/api/reminders/webhook/check-pending`
      : 'http://localhost:3000/api/reminders/webhook/check-pending'
    
    console.log('📞 Calling webhook in background:', webhookUrl)
    
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    })

    const webhookResult = await webhookResponse.json()
    const endTime = Date.now()
    
    if (webhookResponse.ok) {
      console.log('✅ Background webhook completed successfully')
      console.log(`⏱️ Total execution time: ${endTime - startTime}ms`)
      console.log('📊 Webhook result:', webhookResult)
    } else {
      console.error('❌ Background webhook failed:', webhookResult)
    }
    
  } catch (error: any) {
    console.error('❌ Error in background webhook:', error)
  }
}

// ==================== CRON JOB INTERNO ====================
// Ejecuta cada minuto para revisar recordatorios pendientes

cron.schedule('* * * * *', async () => {
  try {
    console.log('🕐 Internal cron triggered - calling webhook...')
    
    const webhookUrl = 'https://back.aurapp.com.mx/api/reminders/webhook/send-upcoming'
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    })

    if (response.ok) {
      console.log('✅ Internal cron completed successfully via webhook')
    } else {
      throw new Error(`Webhook failed: ${response.status}`)
    }
    
  } catch (error: any) {
    console.error('❌ Internal cron webhook error:', error)
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