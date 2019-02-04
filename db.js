const config = require("./config")
const JsonDB = require('node-json-db')
exports.db = db = new JsonDB(config.db_name, true, true)