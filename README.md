
# BookNook - Backend

BookNook is a small online library management system that allows users to explore books, add and manage their own book listings, borrow books, and return borrowed books.

This repository contains the backend API developed using Node.js, Express.js, and MongoDB.

## Technologies Used

- Node.js
- Express.js
- MongoDB Atlas
- MongoDB Node.js Driver
- Better Auth JWT Authentication
- JOSE (JWT Verification)
- Multer (Image Upload)
- ImgBB (Image Hosting)
- CORS
- dotenv

## Features

- Retrieve all available books.
- Retrieve individual book details.
- Add new books.
- Update and delete books.
- Upload book cover images.
- Borrow books and manage borrowing records.
- Return borrowed books.
- Automatically update available book copies.
- Prevent duplicate active borrowing of the same book.
- JWT-based authentication and authorization.
- Restrict book management operations to the book owner.
- Validate incoming data and handle API errors.

## Project Structure

```text
booknook-server/
│
├── config/
│   └── db.js
│
├── middleware/
│   └── auth.middleware.js
│
├── routes/
│   ├── books.routes.js
│   ├── borrows.routes.js
│   └── upload.routes.js
│
├── .env
├── .gitignore
├── index.js
├── package.json
└── README.md
```

## Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/tasfiaanam27/booknook-server.git
```

### 2. Navigate to the project directory

```bash
cd booknook-server
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create a `.env` file in the root directory and add the following variables:

```env
PORT=5000
CLIENT_URL=http://localhost:3000

MONGODB_URI=your_mongodb_connection_string
DB_NAME=booknook

IMGBB_API_KEY=your_imgbb_api_key
```

Replace the placeholder values with your actual credentials.

**Important:** Never upload your `.env` file or expose your database credentials and API keys publicly.

### 5. Run the development server

```bash
npm run dev
```

The backend server will run at:

```text
http://localhost:5000
```

## API Endpoints

### Books

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/books` | Public | Retrieve all books |
| GET | `/books/:id` | Private | Retrieve book details |
| POST | `/books` | Private | Add a new book |
| PATCH | `/books/:id` | Private + Owner | Update a book |
| DELETE | `/books/:id` | Private + Owner | Delete a book |

### Image Upload

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/upload` | Private | Upload a book cover image |

### Borrowing

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/borrows` | Private | Borrow a book |
| GET | `/borrows` | Private | Retrieve the logged-in user's borrow records |
| DELETE | `/borrows/:id` | Private | Return a borrowed book |

## Authentication and Authorization

BookNook uses Better Auth for user authentication and JWT for securing private backend API routes.

- Private endpoints require a valid JWT in the Authorization header.
- The token must be sent using the Bearer authentication scheme.
- Users can update or delete only books they have added.
- Users can access only their own borrowing records.
- User identity is obtained from the verified JWT rather than trusting identity information submitted by the client.

Example authorization header:

```text
Authorization: Bearer YOUR_JWT_TOKEN
```

## Borrowing System

The borrowing system includes the following functionality:

- Users can borrow books only when copies are available.
- A user cannot borrow the same book again while an earlier borrow remains active.
- Available book copies decrease automatically when a book is borrowed.
- Available copies increase when a book is returned.
- Each borrowing record includes a 14-day return period.
- Books with active borrowers cannot be deleted.

## API Response Format

The API uses JSON responses.

Example successful response:

```json
{
  "success": true,
  "message": "Books retrieved successfully",
  "data": []
}
```

Example error response:

```json
{
  "success": false,
  "message": "Book not found"
}
```

## Error Handling

The backend handles common API errors, including:

- Invalid or missing book IDs.
- Missing required information.
- Unauthorized requests.
- Duplicate active borrowing.
- Unavailable book copies.
- Unauthorized book modification.
- Requests to undefined API routes.


