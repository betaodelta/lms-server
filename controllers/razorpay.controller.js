import Razorpay from "razorpay";
import crypto from "crypto";
import { Course } from "../models/course.model.js";
import { CoursePurchase } from "../models/coursePurchase.model.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const createRazorpayOrder = async (req, res) => {
  const { courseId } = req.body;

  const course = await Course.findById(courseId);

  if (!course) {
    return res.status(404).json({
      status: "fail",
      message: "Course not found",
    });
  }

  const options = {
    amount: course.price * 100,
    currency: "INR",
    receipt: `receipt_order_${Date.now()}`,
  };

  const order = await razorpay.orders.create(options);

  res.status(201).json({
    status: "success",
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    courseId: course._id,
  });
};

export const verifyPayment = async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    courseId,
  } = req.body;

  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest("hex");

  if (generatedSignature !== razorpay_signature) {
    return res.status(400).json({
      status: "fail",
      message: "Payment verification failed",
    });
  }

  const existingPurchase = await CoursePurchase.findOne({
    user: req.user._id,
    course: courseId,
  });
  if (existingPurchase) {
    return res.status(409).json({
      status: "fail",
      message: "You already purchased this course",
    });
  }
  await CoursePurchase.create({
    user: req.user._id,
    course: courseId,
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
  });

  res.status(200).json({
    status: "success",
    message: "Payment verified and course purchased",
  });
};
