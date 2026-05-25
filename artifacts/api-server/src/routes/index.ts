import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiCommentRouter from "./ai/comment";
import aiDetectRouter from "./ai/detect";
import aiHumanizeRouter from "./ai/humanize";
import aiProofreadRouter from "./ai/proofread-text";
import aiDefineRouter from "./ai/define";
import aiSummarizeRouter from "./ai/summarize";
import researchSearchRouter from "./research/search";
import thesisRolesRouter from "./thesis/roles";
import citationFormatRouter from "./citation/format";
import citationPlagiarismRouter from "./citation/plagiarism";

const router: IRouter = Router();

router.use(healthRouter);
router.use(aiCommentRouter);
router.use(aiDetectRouter);
router.use(aiHumanizeRouter);
router.use(aiProofreadRouter);
router.use(aiDefineRouter);
router.use(aiSummarizeRouter);
router.use(researchSearchRouter);
router.use(thesisRolesRouter);
router.use(citationFormatRouter);
router.use(citationPlagiarismRouter);

export default router;
