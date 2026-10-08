import healthRoutes from "./health";
import authRoutes from "./auth";
import projectRoutes from "./project";
import userRoutes from "./user";
import {Router} from "express";

const router = Router();
router.use(healthRoutes);
router.use(authRoutes);
router.use("/project", projectRoutes);
router.use("/user", userRoutes);

export default router;
