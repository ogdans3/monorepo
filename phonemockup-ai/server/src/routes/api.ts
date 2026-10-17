import healthRoutes from "./health.js";
import authRoutes from "./auth.js";
import projectRoutes from "./project.js";
import userRoutes from "./user.js";
import {Router} from "express";

const router = Router();
router.use(healthRoutes);
router.use(authRoutes);
router.use("/project", projectRoutes);
router.use("/user", userRoutes);

export default router;
