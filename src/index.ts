import { createServer } from 'http'
import app from './app.js'
import env from './config/enviroment.js'
import { initWebSocketService } from './services/websocket.service.js'

const PORT = env.PORT || 3000

// Crear servidor HTTP
const server = createServer(app)

// Inicializar WebSocket service
const webSocketService = initWebSocketService(server)

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`)
  console.log(`📡 API available at: ${env.SERVER_URL}${env.API_BASE_PATH}`)
  console.log(`🔌 WebSocket server initialized`)
  console.log(`💬 Chat system ready!`)
})
