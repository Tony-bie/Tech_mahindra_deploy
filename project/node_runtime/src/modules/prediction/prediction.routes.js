// project/node_runtime/src/modules/prediction/prediction.routes.js
const express = require('express');
// mergeParams=true permite leer req.params.id cuando se monta con prefijo /projects/:id
const router = express.Router({ mergeParams: true });
const { getProjectPrediction } = require('./prediction.controller');
const { authUser } = require('../../shared/middleware/auth');

// CA-03: el endpoint NO cachea; cada request recalcula con datos actuales.
router.get('/', authUser, getProjectPrediction);

module.exports = router;
