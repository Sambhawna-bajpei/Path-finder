const { Router } = require("express");
const { analyzeResumeController, listAnalysesController, getAnalysisController, deleteAnalysisController } = require("../controllers/workspace.controller");
const { authUser } = require("../middlewares/auth.middleware");

const router = Router();
router.post("/analyze", authUser, analyzeResumeController);
router.get("/history", authUser, listAnalysesController);
router.get("/history/:id", authUser, getAnalysisController);
router.delete("/history/:id", authUser, deleteAnalysisController);
module.exports = router;
