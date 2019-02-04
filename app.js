const express = require('express')
const app = express()
const fs = require("fs")
const config = require("./config")
app.get('******', function (req, res) {
  const code = req.params['0'].substr(1)
  fs.readFile(config.tickets_dir + code + '.txt', 'utf8',(err, data) => { 
  if (err) return res.send('This ticket doesn\'t exist.')
  console.log(data)
  return res.send(data.replace(/(?:\r\n|\r|\n)/g, '<br>'))
}) 
return undefined
})

app.listen(80)
