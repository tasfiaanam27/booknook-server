const express = require("express");
const { ObjectId } = require("mongodb");
const { getDB } = require("../config/db");

const router = express.Router();

const ALLOWED_CATEGORIES = [
  "Fiction",
  "Science",
  "History",
  "Kids",
  "Others",
];

// GET: Retrieve all books
router.get("/", async (req, res) => {
  try {
    const db = getDB();

    const books = await db
      .collection("books")
      .find()
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      message: "Books retrieved successfully",
      data: books,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve books",
      error: error.message,
    });
  }
});

// GET: Retrieve a single book by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID",
      });
    }

    const db = getDB();

    const book = await db.collection("books").findOne({
      _id: new ObjectId(id),
    });

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Book retrieved successfully",
      data: book,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve book",
      error: error.message,
    });
  }
});

// POST: Add a new book
router.post("/", async (req, res) => {
  try {
    const {
      title,
      author,
      category,
      image,
      description,
      addedByName,
      addedByEmail,
      totalCopies,
    } = req.body;

    // Validate required text fields
    if (
      !title?.trim() ||
      !author?.trim() ||
      !category ||
      !image?.trim() ||
      !description?.trim() ||
      !addedByName?.trim() ||
      !addedByEmail?.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required book information",
      });
    }

    // Validate category
    if (!ALLOWED_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book category",
      });
    }

    // Validate total copies
    if (!Number.isInteger(totalCopies) || totalCopies < 1) {
      return res.status(400).json({
        success: false,
        message: "Total copies must be a positive whole number",
      });
    }

    const newBook = {
      title: title.trim(),
      author: author.trim(),
      category,
      image: image.trim(),
      description: description.trim(),
      addedByName: addedByName.trim(),
      addedByEmail: addedByEmail.trim().toLowerCase(),
      totalCopies,
      availableCopies: totalCopies,
      createdAt: new Date(),
    };

    const db = getDB();

    const result = await db.collection("books").insertOne(newBook);

    res.status(201).json({
      success: true,
      message: "Book added successfully",
      data: {
        _id: result.insertedId,
        ...newBook,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to add book",
      error: error.message,
    });
  }
});

// PATCH: Update an existing book
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID",
      });
    }

    const db = getDB();
    const booksCollection = db.collection("books");

    const existingBook = await booksCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!existingBook) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    // Only these fields can be updated
    const allowedFields = [
      "title",
      "author",
      "category",
      "image",
      "description",
      "totalCopies",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update",
      });
    }

    // Validate text fields
    for (const field of [
      "title",
      "author",
      "image",
      "description",
    ]) {
      if (
        updates[field] !== undefined &&
        (typeof updates[field] !== "string" || !updates[field].trim())
      ) {
        return res.status(400).json({
          success: false,
          message: `${field} must be a non-empty string`,
        });
      }

      if (updates[field] !== undefined) {
        updates[field] = updates[field].trim();
      }
    }

    // Validate category
    if (
      updates.category !== undefined &&
      !ALLOWED_CATEGORIES.includes(updates.category)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid book category",
      });
    }

    // Preserve the number of copies already borrowed
    if (updates.totalCopies !== undefined) {
      if (
        !Number.isInteger(updates.totalCopies) ||
        updates.totalCopies < 1
      ) {
        return res.status(400).json({
          success: false,
          message: "Total copies must be a positive whole number",
        });
      }

      const borrowedCopies =
        existingBook.totalCopies - existingBook.availableCopies;

      if (updates.totalCopies < borrowedCopies) {
        return res.status(400).json({
          success: false,
          message: `At least ${borrowedCopies} total copies are needed because some copies are currently borrowed`,
        });
      }

      updates.availableCopies =
        updates.totalCopies - borrowedCopies;
    }

    const result = await booksCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    res.status(200).json({
      success: true,
      message: "Book updated successfully",
      data: {
        ...existingBook,
        ...updates,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update book",
      error: error.message,
    });
  }
});

// DELETE: Remove a book
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID",
      });
    }

    const db = getDB();

    const result = await db.collection("books").deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Book deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete book",
      error: error.message,
    });
  }
});

module.exports = router;