import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiCommentRouter from "./ai/comment";
import aiDetectRouter from "./ai/detect";
import aiProofreadRouter from "./ai/proofread-text";
import aiDefineRouter from "./ai/define";
import aiSummarizeRouter from "./ai/summarize";
import citationFormatRouter from "./citation/format";
import citationPlagiarismRouter from "./citation/plagiarism";

const router: IRouter = Router();

router.use(healthRouter);
router.use(aiCommentRouter);
router.use(aiDetectRouter);
router.use(aiProofreadRouter);
router.use(aiDefineRouter);
router.use(aiSummarizeRouter);
router.use(citationFormatRouter);
router.use(citationPlagiarismRouter);

export default router;
