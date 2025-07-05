import { Course } from "../models/course.model.js";
import { CoursePurchase } from "../models/coursePurchase.model.js";
import { Lecture } from "../models/lecture.model.js";
import { User } from "../models/user.model.js";
import { catchAsync } from "../middleware/error.middleware.js";
import { AppError } from "../middleware/error.middleware.js";
import Razorpay from "razorpay";
import crypto from "crypto";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * Create a Stripe checkout session for course purchase
 * @route POST /api/v1/payments/create-checkout-session
 */
export const initiateRazorpayCheckout = catchAsync(async (req, res) => {
  const { courseId } = req.body;

  const course = await Course.findById(courseId);
  if (!course) {
    throw new AppError("Course not found", 404);
  }

  const alreadyPurchased = await CoursePurchase.findOne({
    user: req.user._id,
    course: courseId,
  });

  if (alreadyPurchased) {
    throw new AppError("You have already purchased this course", 400);
  }

  const orderoptions = {
    amount: course.price * 100,
    currency: "INR",
    receipt: `receipt_order_${Date.now()}`,
    notes: {
      userId: req.user._id.toString(),
      courseId: course._id.toString(),
    },
  };

  const order = await razorpay.orders.create(orderoptions);

  res.status(200).json({
    status: "success",
    message: "Razorpay order created",
    order: {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
    },
    course: {
      id: course._id,
      title: course.title,
      price: course.price,
    },
  });
});

/**
 * Handle Stripe webhook events
 * @route POST /api/v1/payments/webhook
 */
export const handleRazorpayWebhook = catchAsync(async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  const payload = JSON.stringify(req.body);
  const signature = req.headers["x-razorpay-signature"];

  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(payload)
    .digest("hex");

  if (signature !== expectedSignature) {
    return res
      .status(400)
      .json({ status: "fail", message: "Invalid signature" });
  }

  const event = req.body.event;

  if (event === "payment.captured") {
    const payment = req.body.payload.payment.entity;

    console.log("✅ Payment captured:", payment.id);
  }
  res.status(200).json({ status: "success", received: true });
});

/**
 * Get course details with purchase status
 * @route GET /api/v1/payments/courses/:courseId/purchase-status
 */
export const getCoursePurchaseStatus = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { courseId } = req.params;

  const course = await Course.findById(courseId);
  if (!course) {
    throw new AppError("Course not found", 404);
  }

  const purchase = await CoursePurchase.findOne({
    user: userId,
    course: courseId,
  });

  const hasPurcahsed = !!purchase;

  res.status(200).json({
    status: "success",
    courseId,
    hasPurcahsed,
  });
});

/**
 * Get all purchased courses
 * @route GET /api/v1/payments/purchased-courses
 */
export const getPurchasedCourses = catchAsync(async (req, res) => {
  const userId = req.user._id;

  const purchases = await CoursePurchase.find({ user: userId }).populate(
    "course"
  );

  const purchasedCourses = purchases.map((purchase) => purchase.course);

  res.status(200).json({
    status: "success",
    results: purchasedCourses.length,
    courses: purchasedCourses,
  });
});
