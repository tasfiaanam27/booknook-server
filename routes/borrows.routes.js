const express = require("express");
const { ObjectId } = require("mongodb");
const { getDB } = require("../config/db");
const verifyToken = require("../middleware/auth.middleware");

const router = express.Router();

const BORROW_PERIOD_DAYS = 14;

router.post("/", verifyToken, async (req, res) => {
    let stockReserved = false;
    let bookId = null;

    try {
        const { bookId: requestedBookId } = req.body;

        if (!requestedBookId || !ObjectId.isValid(requestedBookId)) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid book ID.",
            });
        }

        bookId = new ObjectId(requestedBookId);

        const db = getDB();
        const booksCollection = db.collection("books");
        const borrowsCollection = db.collection("borrows");

        const book = await booksCollection.findOne({ _id: bookId });

        if (!book) {
            return res.status(404).json({
                success: false,
                message: "Book not found.",
            });
        }

        // Prevent the same user from borrowing the same book twice
        // while their previous borrow is still active.
        const existingBorrow = await borrowsCollection.findOne({
            bookId,
            userEmail: req.user.email,
            status: "active",
        });

        if (existingBorrow) {
            return res.status(409).json({
                success: false,
                message: "You have already borrowed this book and have not returned it yet.",
            });
        }

        // Atomically reserve one available copy.
        const stockResult = await booksCollection.updateOne(
            {
                _id: bookId,
                availableCopies: { $gt: 0 },
            },
            {
                $inc: { availableCopies: -1 },
            }
        );

        if (stockResult.modifiedCount === 0) {
            return res.status(409).json({
                success: false,
                message: "Sorry, this book is currently unavailable.",
            });
        }

        stockReserved = true;

        const borrowDate = new Date();
        const returnDate = new Date(borrowDate);

        returnDate.setDate(
            returnDate.getDate() + BORROW_PERIOD_DAYS
        );

        const borrowRecord = {
            bookId,
            bookTitle: book.title,
            bookImage: book.image,
            userEmail: req.user.email,
            userName: req.user.name,
            borrowDate,
            returnDate,
            status: "active",
            createdAt: new Date(),
        };

        const result = await borrowsCollection.insertOne(borrowRecord);

        stockReserved = false;

        return res.status(201).json({
            success: true,
            message: "Book borrowed successfully.",
            data: {
                _id: result.insertedId,
                ...borrowRecord,
            },
        });
    } catch (error) {
        // Restore stock if the borrow record could not be saved.
        if (stockReserved && bookId) {
            try {
                await getDB()
                    .collection("books")
                    .updateOne(
                        { _id: bookId },
                        { $inc: { availableCopies: 1 } }
                    );
            } catch (rollbackError) {
                console.error("Stock rollback failed:", rollbackError);
            }
        }

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "You already have an active borrow for this book.",
            });
        }

        console.error("Borrow book error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to borrow the book.",
        });
    }
});

// GET: Retrieve the logged-in user's borrow records
router.get("/", verifyToken, async (req, res) => {
    try {
        const db = getDB();

        const borrows = await db
            .collection("borrows")
            .find({
                userEmail: req.user.email,
            })
            .sort({ borrowDate: -1 })
            .toArray();

        return res.status(200).json({
            success: true,
            message: "Borrow records retrieved successfully.",
            data: borrows,
        });
    } catch (error) {
        console.error("Get borrows error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve borrow records.",
        });
    }
});

// DELETE: Return a borrowed book
router.delete("/:id", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid borrow ID.",
            });
        }

        const db = getDB();
        const borrowsCollection = db.collection("borrows");
        const booksCollection = db.collection("books");

        const borrow = await borrowsCollection.findOne({
            _id: new ObjectId(id),
            userEmail: req.user.email,
            status: "active",
        });

        if (!borrow) {
            return res.status(404).json({
                success: false,
                message: "Active borrow record not found.",
            });
        }

        // Mark this borrow as returned only if it is still active.
        const updateResult = await borrowsCollection.updateOne(
            {
                _id: borrow._id,
                userEmail: req.user.email,
                status: "active",
            },
            {
                $set: {
                    status: "returned",
                    returnedAt: new Date(),
                },
            }
        );

        if (updateResult.modifiedCount === 0) {
            return res.status(409).json({
                success: false,
                message: "This book has already been returned.",
            });
        }

        // Restore one available copy.
        const stockResult = await booksCollection.updateOne(
            { _id: borrow.bookId },
            { $inc: { availableCopies: 1 } }
        );

        if (stockResult.matchedCount === 0) {
            // Restore the active status if the book record is unexpectedly missing.
            await borrowsCollection.updateOne(
                { _id: borrow._id, status: "returned" },
                {
                    $set: { status: "active" },
                    $unset: { returnedAt: "" },
                }
            );

            return res.status(404).json({
                success: false,
                message: "The original book record could not be found.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Book returned successfully.",
            data: {
                borrowId: borrow._id,
                bookId: borrow.bookId,
                returnedAt: new Date(),
            },
        });
    } catch (error) {
        console.error("Return book error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to return the book.",
        });
    }
});

module.exports = router;
