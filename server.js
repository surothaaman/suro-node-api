const express = require("express");
const { initializeDatabase } = require("./database");

const app = express();
const PORT = 3000;
const cors = require("cors");

app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type"],
    credentials: false,
  }),
);

// Validate user IDs before running SQL.
function validateUserId(req, res, next) {
  const rawId = req.params.id;
  const userId = Number(rawId);

  if (!/^\d+$/.test(rawId) || !Number.isSafeInteger(userId) || userId <= 0) {
    return res.status(422).json({
      detail: "User ID must be a positive integer.",
    });
  }

  req.userId = userId;
  next();
}

// Shared validation for POST and PATCH.
function validateUserBody(partial = false) {
  return (req, res, next) => {
    const body = req.body;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(422).json({
        detail: "Provide a JSON object with name and email fields.",
      });
    }

    const keys = Object.keys(body);
    const allowedFields = ["name", "email"];

    if (keys.some((key) => !allowedFields.includes(key))) {
      return res.status(422).json({
        detail: "Only name and email are allowed.",
      });
    }

    if (partial && keys.length === 0) {
      return res.status(422).json({
        detail: "Provide a name or email to update.",
      });
    }

    if (
      !partial &&
      (!Object.hasOwn(body, "name") || !Object.hasOwn(body, "email"))
    ) {
      return res.status(422).json({
        detail: "Name and email are required.",
      });
    }

    const validated = {};

    if (Object.hasOwn(body, "name")) {
      if (typeof body.name !== "string") {
        return res.status(422).json({
          detail: "Name must be a string.",
        });
      }

      const name = body.name.trim();

      if (name.length < 1 || name.length > 100) {
        return res.status(422).json({
          detail: "Name must contain 1 to 100 characters.",
        });
      }

      validated.name = name;
    }

    if (Object.hasOwn(body, "email")) {
      if (typeof body.email !== "string") {
        return res.status(422).json({
          detail: "Email must be a string.",
        });
      }

      const email = body.email.trim();

      // Basic email format validation.
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(422).json({
          detail: "Provide a valid email address.",
        });
      }

      validated.email = email;
    }

    req.validatedUser = validated;
    next();
  };
}

function handleDatabaseError(res, error, message) {
  if (
    error.code === "SQLITE_CONSTRAINT" &&
    error.message.includes("UNIQUE constraint failed: users.email")
  ) {
    return res.status(409).json({
      detail: "A user with this email already exists.",
    });
  }

  console.error(message, error);

  return res.status(500).json({
    detail: message,
  });
}

app.get("/", (req, res) => {
  res.json({
    message: "Suro Node API is running",
  });
});

async function startServer() {
  const db = await initializeDatabase();

  // GET ALL USERS
  app.get("/api/v1/users", (req, res) => {
    db.all(
      "SELECT id, name, email, created_at FROM users ORDER BY id",
      [],
      (error, users) => {
        if (error) {
          return handleDatabaseError(res, error, "Unable to retrieve users.");
        }

        return res.json(users);
      },
    );
  });

  // GET USER BY ID
  app.get("/api/v1/users/:id", validateUserId, (req, res) => {
    db.get(
      "SELECT id, name, email, created_at FROM users WHERE id = ?",
      [req.userId],
      (error, user) => {
        if (error) {
          return handleDatabaseError(res, error, "Unable to retrieve user.");
        }

        if (!user) {
          return res.status(404).json({
            detail: "User not found.",
          });
        }

        return res.json(user);
      },
    );
  });

  // CREATE USER
  app.post("/api/v1/users", validateUserBody(), (req, res) => {
    const { name, email } = req.validatedUser;

    db.run(
      "INSERT INTO users (name, email) VALUES (?, ?)",
      [name, email],
      function (error) {
        if (error) {
          return handleDatabaseError(res, error, "Unable to create user.");
        }

        const createdId = this.lastID;

        db.get(
          "SELECT id, name, email, created_at FROM users WHERE id = ?",
          [createdId],
          (error, user) => {
            if (error) {
              return handleDatabaseError(
                res,
                error,
                "User was created, but could not be retrieved.",
              );
            }

            if (!user) {
              return res.status(404).json({
                detail: "Created user no longer exists.",
              });
            }

            return res.status(201).json(user);
          },
        );
      },
    );
  });

  // UPDATE USER
  app.patch(
    "/api/v1/users/:id",
    validateUserId,
    validateUserBody(true),
    (req, res) => {
      const updates = req.validatedUser;
      const assignments = [];
      const values = [];

      if (Object.hasOwn(updates, "name")) {
        assignments.push("name = ?");
        values.push(updates.name);
      }

      if (Object.hasOwn(updates, "email")) {
        assignments.push("email = ?");
        values.push(updates.email);
      }

      values.push(req.userId);

      // Only fixed column names are inserted into SQL.
      // User values are passed separately through placeholders.
      const sql = `UPDATE users SET ${assignments.join(", ")} WHERE id = ?`;

      db.run(sql, values, function (error) {
        if (error) {
          return handleDatabaseError(res, error, "Unable to update user.");
        }

        if (this.changes === 0) {
          return res.status(404).json({
            detail: "User not found.",
          });
        }

        db.get(
          "SELECT id, name, email, created_at FROM users WHERE id = ?",
          [req.userId],
          (error, user) => {
            if (error) {
              return handleDatabaseError(
                res,
                error,
                "User was updated, but could not be retrieved.",
              );
            }

            if (!user) {
              return res.status(404).json({
                detail: "User no longer exists.",
              });
            }

            return res.json(user);
          },
        );
      });
    },
  );

  // DELETE USER
  app.delete("/api/v1/users/:id", validateUserId, (req, res) => {
    db.run("DELETE FROM users WHERE id = ?", [req.userId], function (error) {
      if (error) {
        return handleDatabaseError(res, error, "Unable to delete user.");
      }

      if (this.changes === 0) {
        return res.status(404).json({
          detail: "User not found.",
        });
      }

      return res.json({
        message: "User deleted successfully.",
        id: req.userId,
      });
    });
  });

  // Unknown URL or unsupported method.
  app.use((req, res) => {
    res.status(404).json({
      detail: "Route not found. Check the HTTP method and URL.",
    });
  });

  // Handle malformed JSON and unexpected request errors.
  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    if (error.type === "entity.parse.failed") {
      return res.status(400).json({
        detail: "Invalid JSON request body.",
      });
    }

    if (error.type === "entity.too.large") {
      return res.status(413).json({
        detail: "Request body is too large.",
      });
    }

    console.error("Unexpected request error:", error);

    return res.status(500).json({
      detail: "Internal server error.",
    });
  });

  const server = app.listen(PORT, "127.0.0.1", () => {
    console.log(`Server running at http://127.0.0.1:${PORT}`);
  });

  server.on("error", (error) => {
    console.error("Unable to start HTTP server:", error);
    db.close();
    process.exitCode = 1;
  });
}

startServer().catch((error) => {
  console.error("Unable to start the API:", error);
  process.exitCode = 1;
});
