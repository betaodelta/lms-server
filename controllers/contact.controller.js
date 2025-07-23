import { Contact } from "../models/contact.model.js";
import catchAsync from "../utils/catchAsync.js";

export const createContact = catchAsync(async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res
      .status(400)
      .json({ success: false, message: "All fields are required" });
  }

  await Contact.create({ name, email, message });

  res.status(201).json({
    success: true,
    message: "Message sent successfully",
  });
});
