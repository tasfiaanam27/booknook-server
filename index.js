require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { connectDB } = require("./config/db");
const booksRoutes = require("./routes/books.routes");

const app = express();


// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json());
app.use("/books", booksRoutes);

app.get("/", (req, res) => {
  res.send("BookNook Server is Running!");
});

// Start server and connect to MongoDB
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`BookNook server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error);
  }
};

startServer();
