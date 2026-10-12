# Suro Node User Management API

A standalone REST API built with Node.js, Express, and SQLite.
Database operations use raw SQL and parameterized queries.

## Setup

Install dependencies:

```powershell
npm ci
```

Start the server:

```powershell
node server.js
```

Base URL: http://127.0.0.1:3000

Stop the server with Ctrl + C. Restart it after editing code.

## Project Files

| File | Purpose |
|---|---|
| server.js | Routes, validation, SQL queries, and error responses |
| database.js | SQLite connection and table initialization |
| package.json | Project metadata and dependencies |
| package-lock.json | Locked dependency versions |
| .gitignore | Excludes local databases, dependencies, and secrets |
| suro.db | Automatically created local SQLite database |

## Database Schema

```sql
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

The database is created beside database.js.
Records remain saved after the server restarts.
New users receive a UTC creation timestamp.

This project uses its own database, separate from the Python API.

## Endpoints

| Method | Path | Purpose | Success |
|---|---|---|---|
| GET | / | API status message | 200 |
| GET | /api/v1/users | List users | 200 |
| GET | /api/v1/users/:id | Get one user | 200 |
| POST | /api/v1/users | Create a user | 201 |
| PATCH | /api/v1/users/:id | Update selected fields | 200 |
| DELETE | /api/v1/users/:id | Delete a user | 200 |

Replace :id with an actual user ID when sending requests.

## Request Examples

POST /api/v1/users:

```json
{
  "name": "Suro",
  "email": "suro@example.com"
}
```

PATCH /api/v1/users/1:

```json
{
  "name": "Suro Updated"
}
```

For POST and PATCH, use Content-Type: application/json.

PATCH preserves fields omitted from the request.
GET and DELETE require no request body.

## Validation

- User IDs must be positive safe integers.
- Creation requires name and email.
- Names are trimmed and must contain 1–100 JavaScript string code units.
- Emails are trimmed and checked using a basic format pattern.
- Unexpected fields are rejected.
- PATCH rejects empty objects and explicit null values.
- Duplicate emails are rejected by SQLite's UNIQUE constraint.

Email validation does not verify mailbox ownership.
The current schema does not enforce case-insensitive email uniqueness.

## Error Responses

| Status | Meaning |
|---|---|
| 400 | Malformed JSON |
| 404 | User or route not found |
| 409 | Email already exists |
| 413 | Request body too large |
| 422 | Invalid fields or user ID |
| 500 | Database or unexpected server error |

Errors return JSON containing a detail field.
Internal error information is logged to the server terminal.

## SQL Injection Prevention

User values are passed separately from SQL through ? placeholders.

```javascript
db.get(
  "SELECT id, name, email, created_at FROM users WHERE id = ?",
  [userId],
  callback
);
```

PATCH builds column assignments only from fixed, allowed column names.
User input is never inserted directly into the SQL string.

## Postman Test Checklist

- Create a temporary user and record its ID.
- Retrieve all users and retrieve the temporary user by ID.
- Update only the name and confirm the email stays unchanged.
- Update the email.
- Restart the server and confirm the user remains saved.
- Delete the temporary user.
- Retrieve or delete that ID again and expect 404.
- Submit invalid fields and expect 422.
- Submit a duplicate email and expect 409.

## Python and Node.js Comparison

| Area | Python API | Node.js API |
|---|---|---|
| Framework | FastAPI | Express |
| Database driver | Built-in sqlite3 | npm sqlite3 package |
| Routes | Decorators such as @app.get | Calls such as app.get |
| Validation | Pydantic models | Shared validation middleware |
| Email validation | EmailStr with email-validator | Basic regular expression |
| SQL execution | Synchronous database calls | Callback-based asynchronous calls |
| Result handling | sqlite3.Row converted to dictionaries | JavaScript objects from callbacks |
| API documentation | Generated Swagger /docs | README and Postman requests |
| Local port | 8000 | 3000 |

The Python API uses normal def route handlers, which FastAPI runs in a
thread pool. Its synchronous SQLite calls do not become asynchronous
simply because the framework supports async.

The Node driver performs database work asynchronously and invokes
callbacks when operations finish. A regular function callback is used
with db.run to access this.lastID and this.changes.

Both implementations use raw SQL, parameterized values, database
constraints, and local SQLite files.

## Scope and Limitations

This is a local learning project.

- Authentication and roles are not implemented.
- CORS is configured for the React client, and browser CRUD testing is complete.
- POST and PATCH perform a write followed by a separate read, so a
  concurrent request can change the record before that read completes.
- No automated test suite is included.

## Version Control

Commit source files, package-lock.json, and documentation.
Exclude node_modules, database files, and secrets.
Commit and push completed work daily.