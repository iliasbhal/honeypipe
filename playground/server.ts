import express from 'express'

export const app = express()
const api = express.Router()
app.use('/api', api)

api.get('/ping', (req, res) => {
  res.send('pong')
})
