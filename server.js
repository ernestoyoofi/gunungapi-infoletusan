const express = require('express')
const { WebSocketServer } = require('ws')
const magmascrap = require("./informasi-event")

const port = process.env.PORT || 3000
let client = {}

const app = express()
app.post("/read-report/:id", async (req, res) => {
  const readReport = await magmascrap.GetDetailRequest(req.params.id)
  if(readReport.error) {
    return res.status(readReport.status).json(readReport)
  }
  return res.status(200).json(readReport)
})
const server = app.listen(port, () => {
  console.log(`Start at http://localhost:${port}`)
})

const wss = new WebSocketServer({ server })
wss.on("connection", (ws, req) => {
  const id = require("crypto").randomBytes(20).toString("hex")
  client[id] = ws
  ws.on("close", () => {
    delete client[id]
  })
  ws.on("error", () => {
    delete client[id]
  })
})
magmascrap.EventTimeNotification((data) => {
  Object.keys(client).forEach(id => {
    client[id].send(JSON.stringify(data))
  })
})