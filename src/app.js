import express from 'express'
import { userRouter } from './routers/user.router'
import { errorHandler } from './middlewares/errors.middleware'
import { checkRole } from './middlewares/roles.middleware'


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