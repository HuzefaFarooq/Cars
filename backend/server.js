const express = require("express");
const bodyParser = require("body-parser");
const { Pool } = require("pg");

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ===== DB =====
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ===== INIT TABLE =====
async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      name TEXT,
      phone TEXT,
      postcode TEXT,
      service TEXT,
      status TEXT DEFAULT 'new',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}
init();

// ===== SAVE LEAD =====
async function saveLead(name, phone, postcode, service) {
  await pool.query(
    `INSERT INTO leads (name, phone, postcode, service)
     VALUES ($1, $2, $3, $4)`,
    [name, phone, postcode, service]
  );
}

// ===== WEBHOOK =====
app.post("/api/telnyx/webhook", async (req, res) => {
  try {
    console.log("📩 TELNYX RAW:", JSON.stringify(req.body, null, 2));

    const event = req.body.data?.event_type;
    const payload = req.body.data?.payload;

    const from = payload?.from?.phone_number;
    const text = (payload?.text || "").trim();

    console.log("EVENT:", event);
    console.log("FROM:", from);
    console.log("TEXT:", text);

    // =========================
    // SMS FLOW
    // =========================
    if (event === "message.received") {

      // STEP 1: trigger
      if (text.toUpperCase() === "BOOK") {
        return res.json({
          messages: [
            {
              to: from,
              text:
                "🚗 Car booking started!\n\nReply in this format:\nName\nPostcode\nIssue\nPreferred time",
            },
          ],
        });
      }

      // STEP 2: structured input
      const parts = text.split("\n");

      if (parts.length >= 2) {
        const name = parts[0];
        const postcode = parts[1];
        const service = parts[2] || "not specified";

        await saveLead(name, from, postcode, service);

        return res.json({
          messages: [
            {
              to: from,
              text: "✅ Got it — we’ll confirm your car booking shortly.",
            },
          ],
        });
      }

      // fallback
      return res.json({
        messages: [
          {
            to: from,
            text: "Reply BOOK to start a car booking 🚗",
          },
        ],
      });
    }

    // =========================
    // MISSED CALL FLOW
    // =========================
    if (event === "call.initiated") {
      return res.json({
        messages: [
          {
            to: from,
            text:
              "🚗 Missed your call — reply BOOK to get booked in quickly.",
          },
        ],
      });
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).send("error");
  }
});

// ===== HEALTH =====
app.get("/", (req, res) => {
  res.send("🚗 Car system live");
});

// ===== START =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚗 Car server running on", PORT);
});
