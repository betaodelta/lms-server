import express from "express";
import {
  getCoursePurchaseStatus,
  getPurchasedCourses,
  handleRazorpayWebhook,
  initiateRazorpayCheckout,
} from "../controllers/coursePurchase.controller.js";
import { isAuthenticated } from "../middleware/auth.middleware.js";

const router = express.Router();

router
  .route("/checkout/create-checkout-session")
  .post(isAuthenticated, initiateRazorpayCheckout);
router
  .route("/webhook")
  .post(express.raw({ type: "application/json" }), handleRazorpayWebhook);
router
  .route("/course/:courseId/detail-with-status")
  .get(isAuthenticated, getCoursePurchaseStatus);

router.route("/").get(isAuthenticated, getPurchasedCourses);

export default router;
