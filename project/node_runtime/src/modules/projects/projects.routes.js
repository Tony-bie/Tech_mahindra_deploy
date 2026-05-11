const express = require('express');
const router = express.Router();
const {
    getProjects,
    getManagers,
    getViewers,
    createProject,
    getProjectViewers,
    addViewerToProject,
    removeViewerFromProject,
    getAssignableMembers,
} = require('./projects.controller');
const { authUser, requireRole } = require('../../shared/middleware/auth');
const { validate } = require('../../shared/validators/validate');
const { createProjectSchema, addViewerSchema } = require('./projects.validation');

router.get('/', authUser, getProjects);
router.get('/managers', authUser, requireRole('admin', 'pm'), getManagers);
router.get('/viewers', authUser, requireRole('admin', 'pm'), getViewers);
router.post('/create', authUser, requireRole('admin', 'pm'), validate(createProjectSchema), createProject);
router.get('/:id/viewers', authUser, requireRole('admin', 'pm'), getProjectViewers);
router.get('/:id/assignable', authUser, requireRole('admin', 'pm'), getAssignableMembers);
router.post('/:id/viewers', authUser, requireRole('admin', 'pm'), validate(addViewerSchema), addViewerToProject);
router.delete('/:id/viewers/:viewer_id', authUser, requireRole('admin', 'pm'), removeViewerFromProject);

module.exports = router;
