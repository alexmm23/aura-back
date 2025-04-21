import express from 'express'
import { errorHandler } from './middlewares/errors.middleware.js'
import { checkRole } from './middlewares/roles.middleware.js'
import { userRouter } from './routers/user.router.js'


const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(checkRole)
app.use(errorHandler)
app.use('/api/users', userRouter)
app.get('/', (req, res) => {
    res.send('Hello World!')
})
export default app