import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiCommentRouter from "./ai/comment";
import aiDetectRouter from "./ai/detect";

const router: IRouter = Router();

router.use(healthRouter);
router.use(aiCommentRouter);
router.use(aiDetectRouter);

export default router;
