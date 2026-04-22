// server_cars.js

const express = require("express");
const bodyParser = require("body-parser");
const { Pool } = require("pg");

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// POSTGRES (reuse existing DB)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ========== CONFIG ==========
const BUSINESS_KEYWORD = "BOOK";

// ========== HELPERS ==========
async function saveLead(data) {
  await pool.query(
    `INSERT INTO leads (name, phone, postcode, service, status)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      data.name || null,
      data.phone,
      data.postcode || null,
      data.service || null,
      "new",
    ]
  );
}

// ========== INCOMING SMS WEBHOOK ==========
app.post("/sms/inbound", async (req, res) => {
  try {
    const { from, body } = req.body;

    const text = body.trim().toUpperCase();

    // STEP 1: keyword trigger
    if (text === BUSINESS_KEYWORD) {
      return res.json({
        messages: [
          {
            to: from,
            text:
              "Hi 👋 Please reply with:\n1. Name\n2. Postcode\n3. What you need\n4. Preferred time",
          },
        ],
      });
    }

    // STEP 2: assume structured reply (simple MVP parser)
    const parts = body.split("\n");

    if (parts.length >= 2) {
      const name = parts[0];
      const postcode = parts[1];
      const service = parts[2] || "not specified";

      await saveLead({
        name,
        phone: from,
        postcode,
        service,
      });

      return res.json({
        messages: [
          {
            to: from,
            text:
              "Thanks — we’ve received your request. We’ll confirm shortly 👍",
          },
        ],
      });
    }

    // fallback
    return res.json({
      messages: [
        {
          to: from,
          text: "Reply BOOK to start a booking request.",
        },
      ],
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});

// ========== MISSED CALL WEBHOOK ==========
app.post("/call/missed", async (req, res) => {
  try {
    const { from } = req.body;

    return res.json({
      messages: [
        {
          to: from,
          text:
            "Sorry we missed your call. To get booked in quickly, reply BOOK 👍",
        },
      ],
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});

// ========== HEALTH ==========
app.get("/", (req, res) => {
  res.send("Cars booking SMS system running");
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log("Cars server running on", PORT));
