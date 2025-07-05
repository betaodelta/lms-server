import { CourseProgress } from "../models/courseProgress.js";
import { Course } from "../models/course.model.js";
import { catchAsync } from "../middleware/error.middleware.js";
import { AppError } from "../middleware/error.middleware.js";
import e from "express";

/**
 * Get user's progress for a specific course
 * @route GET /api/v1/progress/:courseId
 */
export const getUserCourseProgress = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const courseId = req.params.courseId;

  const course = await Course.findById(courseId);

  if (!course) {
    throw new AppError("Course not found", 404);
  }

  const progress = await CourseProgress.findOne({
    user: userId,
    course: courseId,
  });

  if (!progress) {
    return res.status(200).json({
      status: "success",
      message: "No progress found for this course",
      progress: {
        completedLectures: course.totalLectures,
        percentage: 0,
      },
    });
  }

  const completedLectures = progress.completedLectures.length;
  const totalLectures = course.totalLectures;
  const percentage =
    totalLectures > 0
      ? Math.round((completedLectures / totalLectures) * 100)
      : 0;

  res.status(200).json({
    status: "success",
    progress: {
      completedLectures,
      totalLectures,
      percentage,
    },
  });
});

/**
 * Update progress for a specific lecture
 * @route PATCH /api/v1/progress/:courseId/lectures/:lectureId
 */
export const updateLectureProgress = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { courseId, lectureId } = req.params;

  const course = await Course.findById(courseId);
  if (!course) {
    throw new AppError("Course not found", 404);
  }

  let progress = await CourseProgress.findOne({
    user: userId,
    course: courseId,
  });

  // If no progress yet then create a new progress document
  if (!progress) {
    progress = await CourseProgress.create({
      user: userId,
      course: courseId,
      completedLectures: [lectureId],
    });
  } else {
    // Add lectures to completed list if not already present
    if (!progress.completedLectures.includes(lectureId)) {
      progress.completedLectures.push(lectureId);
      await progress.save();
    }
  }

  // calculate the percentage
  const completedLectures = progress.completedLectures.length;
  const totalLectures = course.totalLectures;
  const percentage =
    totalLectures > 0
      ? Math.round((completedLectures / totalLectures) * 100)
      : 0;

  res.status(200).json({
    status: "success",
    message: "Lecture progress updated successfully",
    progress: {
      completedLectures,
      totalLectures,
      percentage,
    },
  });
});

/**
 * Mark entire course as completed
 * @route PATCH /api/v1/progress/:courseId/complete
 */
export const markCourseAsCompleted = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { courseId } = req.params;

  const course = await Course.findById(courseId);
  if (!course) {
    throw new AppError("Course not found", 404);
  }

  const isEnrolled = course.enrolledStudents.includes(userId);
  if (!isEnrolled) {
    throw new AppError("You are not enrolled in this course", 403);
  }

  let progress = await CourseProgress.findOne({
    user: userId,
    course: courseId,
  });

  if (!progress) {
    // If progress record not found, create empty progress
    progress = await CourseProgress.create({
      user: userId,
      course: courseId,
      completedLectures: [],
    });
  }

  const completedLectures = progress.completedLectures.length;
  const totalLectures = course.totalLectures;
  const percentage =
    totalLectures > 0
      ? Math.round((completedLectures / totalLectures) * 100)
      : 0;
  if (percentage == 100) {
    res.status(200).json({
      status: "success",
      message: "Now you are eligible for certificate",
      percentage,
    });
  } else {
    res.status(200).json({
      status: "success",
      message:
        "You are not eligible for certificate complete the remaining course",
      percentage,
    });
  }
});

/**
 * Reset course progress
 * @route PATCH /api/v1/progress/:courseId/reset
 */
export const resetCourseProgress = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { courseId } = req.params;

  const course = await Course.findById(courseId);

  if (!course) {
    throw new AppError("Course not found", 404);
  }

  const isEnrolled = course.enrolledStudents.includes(userId);
  if (!isEnrolled) {
    throw new AppError("You are not enrolled in this course", 403);
  }

  let progress = await CourseProgress.findOne({
    user: userId,
    course: courseId,
  });

  if (!progress) {
    return res.status(200).json({
      status: "success",
      message: "No progress to reset",
    });
  }

  progress.completedLectures = [];
  progress.percentage = 0;

  await progress.save();

  res.status(200).json({
    status: "success",
    message: "Course progress has been reset",
    progress: {
      completedLectures: [],
      percentage: 0,
    },
  });
});
