const { createRemoteJWKSet, jwtVerify } = require("jose");

const authBaseURL = process.env.CLIENT_URL;

if (!authBaseURL) {
  throw new Error("CLIENT_URL is missing from the server environment.");
}

const JWKS = createRemoteJWKSet(
  new URL("/api/auth/jwks", authBaseURL)
);

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please log in.",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is missing.",
      });
    }

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: authBaseURL,
      audience: authBaseURL,
    });

    if (!payload.sub || !payload.email) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
    }

    // Only use identity information from the verified JWT.
    req.user = {
      id: payload.sub,
      email: String(payload.email).toLowerCase(),
      name: payload.name || "",
    };

    next();
  } catch (error) {
    console.error("JWT verification failed:", error.message);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token. Please log in again.",
    });
  }
};

module.exports = verifyToken;
