const express = require('express')
const router = express.Router()

const { get_projects, chat_bot } = require('./suggestions.controller')
const { authUser } = require('../../shared/middleware/auth')

router.get('/get-projects', authUser, get_projects)
router.post('/chat-bot', chat_bot)

module.exports = router