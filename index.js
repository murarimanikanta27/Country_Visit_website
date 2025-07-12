import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const port = 3000;

// Setup __dirname with ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PostgreSQL client
const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "learn",
  password: "Manikanta@123",
  port: 5432,
});
db.connect().catch(err => console.error("DB connection error:", err));

// App config
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");

let currentUserId = 1;
let users = [];

// Fetch all users & find current
async function loadUsers() {
  const res = await db.query("SELECT * FROM users ORDER BY id");
  users = res.rows;
  return users.find(u => u.id === currentUserId) || users[0];
}

// Fetch visited countries
async function loadCountries(userId) {
  const res = await db.query(
    "SELECT country_code FROM visited_countries WHERE user_id = $1",
    [userId]
  );
  return res.rows.map(r => r.country_code);
}

// Home route
app.get("/", async (req, res) => {
  try {
    const currentUser = await loadUsers();
    currentUserId = currentUser.id;
    const countries = await loadCountries(currentUserId);

    res.render("index.ejs", {
      users,
      currentUserId,
      color: currentUser.color,
      countries,
      total: countries.length,
      error: null
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal server error");
  }
});

// Add country
app.post("/add", async (req, res) => {
  const input = req.body.country.trim().toLowerCase();
  try {
    const r = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%'",
      [input]
    );
    if (!r.rows.length) {
      return res.render("index.ejs", {
        users,
        currentUserId,
        color: users.find(u=>u.id===currentUserId).color,
        countries: await loadCountries(currentUserId),
        total: 0,
        error: "Country not found"
      });
    }
    const code = r.rows[0].country_code;
    await db.query(
      "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [code, currentUserId]
    );
    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error adding country");
  }
});

// Switch user or go to add-new
app.post("/user", (req, res) => {
  if (req.body.add === "new") {
    res.redirect("/new");
  } else {
    currentUserId = parseInt(req.body.user);
    res.redirect("/");
  }
});

// Show new-user form
app.get("/new", (req, res) => res.render("new.ejs"));

// Create new user
app.post("/new", async (req, res) => {
  const { name, color } = req.body;
  try {
    const r = await db.query(
      "INSERT INTO users (name, color) VALUES ($1, $2) RETURNING id",
      [name, color]
    );
    currentUserId = r.rows[0].id;
    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error creating user");
  }
});

// Run server
app.listen(port, () => console.log(`Server is up at http://localhost:${port}`));
