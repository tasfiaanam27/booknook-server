const express = require("express");
const multer = require("multer");
const verifyToken = require("../middleware/auth.middleware");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, callback) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return callback(
        new Error("Only JPG, PNG, and WebP images are allowed.")
      );
    }

    callback(null, true);
  },
});

// POST: Upload a book cover image (PRIVATE)
router.post("/", verifyToken, (req, res) => {
  upload.single("image")(req, res, async (uploadError) => {
    if (uploadError) {
      return res.status(400).json({
        success: false,
        message: uploadError.message,
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select a book cover image.",
      });
    }

    if (!process.env.IMGBB_API_KEY) {
      return res.status(500).json({
        success: false,
        message: "ImgBB API key is not configured.",
      });
    }

    try {
      const formData = new FormData();

      formData.append(
        "image",
        new Blob([req.file.buffer], {
          type: req.file.mimetype,
        }),
        req.file.originalname
      );

      const response = await fetch(
        `https://api.imgbb.com/1/upload?key=${encodeURIComponent(
          process.env.IMGBB_API_KEY
        )}`,
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success || !result.data?.url) {
        return res.status(502).json({
          success: false,
          message: "Image upload failed. Please try again.",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Image uploaded successfully.",
        data: {
          url: result.data.url,
        },
      });
    } catch (error) {
      console.error("ImgBB upload error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to upload the image right now.",
      });
    }
  });
});

module.exports = router;

