require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { connectDB, getDB } = require("./config/db");

const booksRoutes = require("./routes/books.routes");
const uploadRoutes = require("./routes/upload.routes");
const borrowsRoutes = require("./routes/borrows.routes");

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json());

app.use("/books", booksRoutes);
app.use("/upload", uploadRoutes);
app.use("/borrows", borrowsRoutes);

app.get("/", (req, res) => {
  res.send("BookNook Server is Running!");
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    await getDB()
      .collection("borrows")
      .createIndex(
        {
          userEmail: 1,
          bookId: 1,
        },
        {
          unique: true,
          partialFilterExpression: {
            status: "active",
          },
          name: "unique_active_borrow_per_user_book",
        }
      );

    console.log("Borrow collection index ready.");

    app.listen(PORT, () => {
      console.log(`BookNook server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error);
  }
};

startServer();
