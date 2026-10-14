const { Router } = require("express");
const { analyzeResumeController, listAnalysesController, getAnalysisController, deleteAnalysisController } = require("../controllers/workspace.controller");
const { authUser } = require("../middlewares/auth.middleware");
const applications = require("../controllers/application.controller");

const router = Router();
router.post("/analyze", authUser, analyzeResumeController);
router.get("/history", authUser, listAnalysesController);
router.get("/history/:id", authUser, getAnalysisController);
router.delete("/history/:id", authUser, deleteAnalysisController);
router.get("/applications", authUser, applications.listApplications);
router.post("/applications", authUser, applications.createApplication);
router.get("/applications/:id", authUser, applications.getApplication);
router.patch("/applications/:id", authUser, applications.updateApplication);
router.delete("/applications/:id", authUser, applications.deleteApplication);
router.post("/applications/:id/versions", authUser, applications.createResumeVersion);
router.patch("/applications/:id/versions/:versionId/activate", authUser, applications.activateResumeVersion);
module.exports = router;
