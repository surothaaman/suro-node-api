const sqlite3 = require("sqlite3");
const path = require("path");

const databasePath = path.join(__dirname, "suro.db");

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(databasePath, (error) => {
      if (error) {
        reject(error);
        return;
      }

      db.run(
        `CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        (error) => {
          if (error) {
            db.close();
            reject(error);
            return;
          }

          resolve(db);
        }
      );
    });
  });
}

module.exports = { initializeDatabase };