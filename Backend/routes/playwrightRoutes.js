const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const recorderController = require('../controllers/playwrightRecorderController');
const runController = require('../controllers/playwrightRunController');

const MENU = '/test-cases';

router.post(
  '/recorder/start',
  verifyToken,
  checkPermission(MENU, 'can_create'),
  recorderController.startRecording
);

router.post(
  '/recorder/stop/:id',
  verifyToken,
  checkPermission(MENU, 'can_create'),
  recorderController.stopRecording
);

router.post(
  '/parse-steps',
  verifyToken,
  checkPermission(MENU, 'can_view'),
  runController.parseSteps
);

router.post(
  '/test-cases/:id/run',
  verifyToken,
  checkPermission(MENU, 'can_edit'),
  runController.runTestCase
);

router.get(
  '/test-cases/:id/runs',
  verifyToken,
  checkPermission(MENU, 'can_view'),
  runController.getRunsByTestCase
);

router.get(
  '/runs/:runId',
  verifyToken,
  checkPermission(MENU, 'can_view'),
  runController.getRunById
);

router.get(
  '/runs/:runId/steps',
  verifyToken,
  checkPermission(MENU, 'can_view'),
  runController.getRunSteps
);

router.post(
  '/runs/:runId/cancel',
  verifyToken,
  checkPermission(MENU, 'can_edit'),
  runController.cancelRun
);

router.get(
  '/stats',
  verifyToken,
  checkPermission(MENU, 'can_view'),
  runController.getStats
);

router.get(
  '/:id/runs',
  verifyToken,
  checkPermission(MENU, 'can_view'),
  runController.getRunsByTestCase
);

module.exports = router;
