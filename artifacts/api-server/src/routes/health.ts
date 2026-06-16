import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// Service-root healthcheck. The autoscale deployment probes the service base
// path (GET /api) to decide whether to route traffic to this runnable artifact.
// Without a 200 here the api-server is marked unhealthy and /api/* returns the
// platform 404 in production, breaking every AI tool. Keep this in addition to
// /api/healthz.
router.get("/", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
