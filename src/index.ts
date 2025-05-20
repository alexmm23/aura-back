import app from './app.js'
import env from './config/enviroment.js'

const PORT = env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
  console.log(`API available at: ${env.SERVER_URL}${env.API_BASE_PATH}`)
})
