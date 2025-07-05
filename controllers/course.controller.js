import { Course } from "../models/course.model.js";
import { Lecture } from "../models/lecture.model.js";
import { User } from "../models/user.model.js";
import { deleteMediaFromCloudinary, uploadMedia } from "../utils/cloudinary.js";
import { catchAsync } from "../middleware/error.middleware.js";
import { AppError } from "../middleware/error.middleware.js";

/**
 * Create a new course
 * @route POST /api/v1/courses
 */
export const createNewCourse = catchAsync(async (req, res) => {
  const { title, subtitle, description, category, level, price, isPublished } =
    req.body;

  if (!title || !description || !category || !price) {
    throw new AppError(
      "Title, description, category, and price are required",
      400
    );
  }

  if (!req.file) {
    throw new AppError("Course thumbnail is required", 400);
  }

  const uploadResult = await uploadMedia(req.file.path);

  const course = await Course.create({
    title,
    subtitle,
    description,
    category,
    level,
    price,
    thumbnail: uploadResult.url,
    instructor: req.user._id,
    isPublished: isPublished || false,
  });

  res.status(200).json({
    status: "success",
    message: "Course created succesfully",
    course,
  });
});

/**
 * Search courses with filters
 * @route GET /api/v1/courses/search
 */
export const searchCourses = catchAsync(async (req, res) => {
  const {
    keyword,
    category,
    level,
    minPrice,
    maxPrice,
    minRating,
    sortBy,
    page = 1,
    limit = 10,
  } = req.query;

  const filter = {};

  if (keyword) {
    filter.$or = [
      {
        title: {
          $regex: keyword,
          $options: "i",
        },
      },
      {
        description: {
          $regex: keyword,
          $options: "i",
        },
      },
    ];
  }

  if (category) {
    filter.category = category;
  }

  if (level) {
    filter.level = level;
  }

  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }

  const courses = await Course.find(filter)
    .populate("instructor", "name")
    .lean();

  let filteredCourses = courses;
  if (minRating) {
    filteredCourses = courses.filter(
      (course) =>
        (course.ratings?.length > 0
          ? course.ratings.reduce((a, b) => a + b.value, 0) /
            course.ratings.length
          : 0) >= Number(minRating)
    );
  }

  if (sortBy) {
    if (sortBy === "priceAsc")
      filteredCourses.sort((a, b) => a.price - b.price);

    if (sortBy === "priceDesc")
      filteredCourses.sort((a, b) => b.price - a.price);

    if (sortBy === "ratingDesc") {
      filteredCourses.sort((a, b) => {
        const avgA =
          a.ratings?.length > 0
            ? a.ratings.reduce((sum, r) => sum + r.value, 0) / a.ratings.length
            : 0;
        const avgB =
          b.ratings?.length > 0
            ? b.ratings.reduce((sum, r) => sum + r.value, 0) / b.ratings.length
            : 0;
        return avgB - avgA;
      });
    }
  }

  const startIndex = (page - 1) * limit;
  const paginatedCourses = filteredCourses.slice(
    startIndex,
    startIndex + Number(limit)
  );

  res.status(200).json({
    status: "success",
    results: paginatedCourses.length,
    total: filteredCourses.length,
    page: Number(page),
    limit: Number(limit),
    courses: paginatedCourses,
  });
});

/**
 * Get all published courses
 * @route GET /api/v1/courses/published
 */
export const getPublishedCourses = catchAsync(async (req, res) => {
  const courses = await Course.find({ isPublished: true })
    .populate("instructor", "name")
    .select("-lectures")
    .lean();

  res.status(200).json({
    status: "success",
    results: courses.length,
    courses,
  });
});

/**
 * Get courses created by the current user
 * @route GET /api/v1/courses/my-courses
 */
export const getMyCreatedCourses = catchAsync(async (req, res) => {
  const instructorId = req.user._id;

  const courses = await Course.find({ instructor: instructorId })
    .select("-lectures")
    .lean();

  if (courses.length === 0) {
    return res.status(200).json({
      status: "success",
      message: "No courses found",
      courses: [],
    });
  }

  res.status(200).json({
    status: "success",
    results: courses.length,
    courses,
  });
});

/**
 * Update course details
 * @route PATCH /api/v1/courses/:courseId
 */
export const updateCourseDetails = catchAsync(async (req, res) => {
  const courseId = req.params.id;
  const userId = req.user._id;

  const course = await Course.findById(courseId);

  if (!course) {
    throw new AppError("Course not found", 404);
  }

  if (course.instructor.toString() !== userId.toString()) {
    throw new AppError("You are not authorized to update this course", 403);
  }

  const allowedFields = [
    "title",
    "subtitle",
    "description",
    "price",
    "category",
    "level",
    "isPublished",
  ];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      course[field] = req.body[field];
    }
  });

  await course.save();

  res.status(200).json({
    status: "success",
    message: "Course updated successfully",
    course,
  });
});

/**
 * Get course by ID
 * @route GET /api/v1/courses/:courseId
 */
export const getCourseDetails = catchAsync(async (req, res) => {
  const courseId = req.params.id;

  const course = await Course.findById(courseId)
    .populate("instructor", "name email")
    .populate("lectures")
    .lean();

  if (!course) {
    throw new AppError("Course not found", 404);
  }

  if (course.ratings && course.ratings.length > 0) {
    const total = course.ratings.reduce((sum, r) => sum + r.value, 0);
    course.averageRating = total / course.ratings.length;
  } else {
    course.averageRating = 0;
  }

  res.status(200).json({
    status: "success",
    course,
  });
});

/**
 * Add lecture to course
 * @route POST /api/v1/courses/:courseId/lectures
 */
export const addLectureToCourse = catchAsync(async (req, res) => {
  const courseId = req.params.courseId;
  const userId = req.user._id;

  const { title, description } = req.body;

  if (!title || !description || !req.file) {
    throw new AppError(
      "All fields (title, description, video) are required",
      400
    );
  }

  const course = await Course.findById(courseId);
  if (!course) {
    throw new AppError("course not found", 404);
  }

  if (course.instructor.toString() !== userId.toString()) {
    throw new AppError(
      "You are not authorized to add lectures to this course",
      403
    );
  }

  const uploadResult = await uploadMedia(req.file.path, "video");

  const newLecture = await Lecture.create({
    title,
    description,
    video: {
      public_id: uploadResult.public_id,
      url: uploadResult.secure_url,
    },
    duration: uploadResult.duration || 0,
  });

  course.lectures.push(newLecture._id);
  course.totalLectures = course.lectures.length;
  course.totalDuration += newLecture.duration;

  await course.save();

  res.status(200).json({
    status: "success",
    message: "Lecture added to course successfully",
    lecture: newLecture,
  });
});

/**
 * Get course lectures
 * @route GET /api/v1/courses/:courseId/lectures
 */
export const getCourseLectures = catchAsync(async (req, res) => {
  const courseId = req.params.courseId;

  const course = await Course.findById(courseId).populate("lectures");

  if (!course) {
    throw new AppError("Course not found", 400);
  }

  if (
    course.instructor.toString() !== req.user._id.toString() &&
    !course.enrolledStudents.includes(req.user._id)
  ) {
    throw new AppError("You are not enrolled in this course", 403);
  }

  res.status(200).json({
    status: "success",
    lectures: course.lectures,
  });
});

/**
 * Delete a course
 * @route DELETE /api/v1/courses/:courseId
 */
export const deleteCourseById = catchAsync(async (req, res) => {
  const courseId = req.params.courseId;
  const userId = req.user._id;

  const course = await Course.findById(courseId);
  if (!course) {
    throw new AppError("Course not found", 404);
  }

  if (course.instructor.toString() !== userId.toString()) {
    throw new AppError("You are not authorized to delete this course", 403);
  }

  // Optional: Delete thumbnail from cloud
  const thumbnailPublicId = course.thumbnail?.split("/").pop().split(".")[0];
  if (thumbnailPublicId) {
    await deleteMediaFromCloudinary(thumbnailPublicId);
  }

  // Delete all lectures associated with the course
  await Lecture.deleteMany({ _id: { $in: course.lectures } });

  // Delete the course
  await course.deleteOne();

  res.status(200).json({
    status: "success",
    message: "Course deleted successfully",
  });
});
