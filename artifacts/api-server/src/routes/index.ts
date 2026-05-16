import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiCommentRouter from "./ai/comment";

const router: IRouter = Router();

router.use(healthRouter);
router.use(aiCommentRouter);

export default router;
