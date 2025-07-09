import { Contact } from "../models/contact.model.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../middleware/error.middleware.js";

export const submitContactForm = catchAsync(
  async (requestAnimationFrame, res) => {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      throw new AppError("All fields are required", 400);
    }

    const contact = await Contact.create({ name, email, message });

    res.status(200).json({
      success: "true",
      message: "Your message has been submitted successfully",
      contact,
    });
  }
);
