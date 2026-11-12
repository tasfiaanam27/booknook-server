const express = require("express");
const { ObjectId } = require("mongodb");
const { getDB } = require("../config/db");
const verifyToken = require("../middleware/auth.middleware");

const router = express.Router();

const ALLOWED_CATEGORIES = [
    "Fiction",
    "Science",
    "History",
    "Kids",
    "Others",
];

// GET: Retrieve all books (PUBLIC)
router.get("/", async (req, res) => {
    try {
        const db = getDB();

        const query = db
            .collection("books")
            .find()
            .sort({ createdAt: -1 });

        const limit = Number(req.query.limit);

        if (Number.isInteger(limit) && limit > 0) {
            query.limit(limit);
        }

        const books = await query.toArray();

        return res.status(200).json({
            success: true,
            message: "Books retrieved successfully",
            data: books,
        });
    } catch (error) {
        console.error("Get books error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve books",
        });
    }
});

// GET: Retrieve one book (PRIVATE)
router.get("/:id", verifyToken, async (req, res) => {
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

        return res.status(200).json({
            success: true,
            message: "Book retrieved successfully",
            data: book,
        });
    } catch (error) {
        console.error("Get book details error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve book",
        });
    }
});

// POST: Add a new book (PRIVATE)
router.post("/", verifyToken, async (req, res) => {
    try {
        const {
            title,
            author,
            category,
            image,
            description,
            totalCopies,
        } = req.body;

        // User identity comes from the verified JWT.
        const addedByName = req.user.name || req.user.email;
        const addedByEmail = req.user.email;

        if (
            typeof title !== "string" ||
            !title.trim() ||
            typeof author !== "string" ||
            !author.trim() ||
            !category ||
            typeof image !== "string" ||
            !image.trim() ||
            typeof description !== "string" ||
            !description.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required book information",
            });
        }

        if (!ALLOWED_CATEGORIES.includes(category)) {
            return res.status(400).json({
                success: false,
                message: "Invalid book category",
            });
        }

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
            addedByName,
            addedByEmail,
            totalCopies,
            availableCopies: totalCopies,
            createdAt: new Date(),
        };

        const db = getDB();

        const result = await db.collection("books").insertOne(newBook);

        return res.status(201).json({
            success: true,
            message: "Book added successfully",
            data: {
                _id: result.insertedId,
                ...newBook,
            },
        });
    } catch (error) {
        console.error("Add book error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to add book",
        });
    }
});

// PATCH: Update a book (PRIVATE + OWNER ONLY)
router.patch("/:id", verifyToken, async (req, res) => {
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

        // Find the book only if it belongs to the logged-in user.
        const existingBook = await booksCollection.findOne({
            _id: new ObjectId(id),
            addedByEmail: req.user.email,
        });

        if (!existingBook) {
            return res.status(404).json({
                success: false,
                message: "Book not found or you are not authorized to update it",
            });
        }

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

        // Validate text fields.
        for (const field of [
            "title",
            "author",
            "image",
            "description",
        ]) {
            if (
                updates[field] !== undefined &&
                (typeof updates[field] !== "string" ||
                    !updates[field].trim())
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

        if (
            updates.category !== undefined &&
            !ALLOWED_CATEGORIES.includes(updates.category)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid book category",
            });
        }

        // Preserve copies that are already borrowed.
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

        await booksCollection.updateOne(
            {
                _id: new ObjectId(id),
                addedByEmail: req.user.email,
            },
            { $set: updates }
        );

        return res.status(200).json({
            success: true,
            message: "Book updated successfully",
            data: {
                ...existingBook,
                ...updates,
            },
        });
    } catch (error) {
        console.error("Update book error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update book",
        });
    }
});

// DELETE: Remove a book (PRIVATE + OWNER ONLY)
router.delete("/:id", verifyToken, async (req, res) => {
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

        // Check ownership before deleting.
        const book = await booksCollection.findOne({
            _id: new ObjectId(id),
            addedByEmail: req.user.email,
        });

        if (!book) {
            return res.status(404).json({
                success: false,
                message: "Book not found or you are not authorized to delete it",
            });
        }

        // Do not delete a book that still has active borrowers.
        const activeBorrows = await db.collection("borrows").countDocuments({
            bookId: new ObjectId(id),
            status: "active",
        });

        if (activeBorrows > 0) {
            return res.status(409).json({
                success: false,
                message: "This book cannot be deleted while copies are borrowed",
            });
        }

        const result = await booksCollection.deleteOne({
            _id: new ObjectId(id),
            addedByEmail: req.user.email,
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Book not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Book deleted successfully",
        });
    } catch (error) {
        console.error("Delete book error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete book",
        });
    }
});

module.exports = router;
