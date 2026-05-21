import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiCommentRouter from "./ai/comment";
import aiDetectRouter from "./ai/detect";
import citationFormatRouter from "./citation/format";
import citationPlagiarismRouter from "./citation/plagiarism";

const router: IRouter = Router();

router.use(healthRouter);
router.use(aiCommentRouter);
router.use(aiDetectRouter);
router.use(citationFormatRouter);
router.use(citationPlagiarismRouter);

export default router;
