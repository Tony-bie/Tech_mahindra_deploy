const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { errorHandler } = require('./shared/errors/errorHandler');

const authRoutes = require('./modules/auth/auth.routes');
const projectRoutes = require('./modules/projects/projects.routes');
const userRoutes = require('./modules/users/users.routes');
const workItemsRoutes = require('./modules/work_items/work_items.routes');
const sprintRoutes = require('./modules/sprints/sprints.routes')
const SprintBoardRoutes = require('./modules/sprintBoard/sprintBoard.route')
const costsRoutes = require('./modules/costs/costs.routes')
const blockersRoutes = require('./modules/blockers/blockers.routes')
const suggestionsRoutes = require('./modules/suggestions/suggestions.routes')
const dashboardRoutes = require('./modules/dashboard/dashboard.routes')
const risksRoutes     = require('./modules/risks/risks.routes')

const app = express();

require('../WsServer') 


app.use(express.json());
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
}));
app.use(cookieParser());

app.use('/auth', authRoutes);
app.use('/projects', projectRoutes);
app.use('/users', userRoutes);
app.use('/work-items', workItemsRoutes);
app.use('/sprints', sprintRoutes)
app.use('/sprintBoard', SprintBoardRoutes)
app.use('/costs', costsRoutes)
app.use('/blockers', blockersRoutes)
app.use('/suggestions', suggestionsRoutes)
app.use('/dashboard', dashboardRoutes)
app.use('/risks',     risksRoutes)

app.use(errorHandler);

module.exports = app;