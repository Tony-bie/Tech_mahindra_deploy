const express = require('express')
const router = express.Router()

const { get_projects, get_info_all_project, chat_bot } = require('./suggestions.controller')
const { authUser } = require('../../shared/middleware/auth')

router.get('/get-projects', authUser, get_projects)
router.post('/get_info_all_project', get_info_all_project)
router.post('/chatbot', chat_bot)

module.exports = router