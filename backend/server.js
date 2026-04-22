const express = require("express");
const { Pool } = require("pg");
const fetch = require("node-fetch");
require("dotenv").config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

console.log("🚗 Cars server starting...");

// ================= DATABASE =================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ================= TELNYX =================
const TELNYX_API_KEY = process.env.TELNYX_API_KEY;
const FROM_NUMBER = process.env.TELNYX_FROM_NUMBER;

// ================= SIMPLE STATE =================
const state = new Map();

// ================= SMS SENDER =================
async function sendSMS(to, text) {
  try {
    await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TELNYX_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_NUMBER,
        to,
        text,
      }),
    });
  } catch (err) {
    console.error("❌ SMS ERROR:", err);
  }
}

// ================= WEBHOOK =================
app.post("/api/telnyx/webhook", async (req, res) => {
  try {
    const event = req.body.data?.event_type;
    const payload = req.body.data?.payload;

    const from = payload?.from?.phone_number;
    const textRaw = payload?.text || "";
    const text = textRaw.trim().toUpperCase();

    console.log("📩 EVENT:", event);
    console.log("FROM:", from);
    console.log("TEXT:", text);

    if (!from) return res.sendStatus(200);

    // ================= SMS =================
    if (event === "message.received") {

      // RESET STATE
      if (!state.has(from)) {
        state.set(from, { step: 0 });
      }

      const userState = state.get(from);

      // 🚗 ENTRY POINT
      if (text === "BOOK") {
        userState.step = 1;

        await sendSMS(
          from,
          "🚗 Car booking started!\n\nReply with:\n1. Name\n2. Postcode\n3. What you need\n4. Preferred time"
        );

        state.set(from, userState);
        return res.sendStatus(200);
      }

      // ================= STEP FLOW (simple MVP) =================

      if (userState.step === 1) {
        userState.name = textRaw;
        userState.step = 2;

        await sendSMS(from, "📍 Got it. What is your postcode?");
        state.set(from, userState);
        return res.sendStatus(200);
      }

      if (userState.step === 2) {
        userState.postcode = textRaw;
        userState.step = 3;

        await sendSMS(from, "🚗 What do you need? (e.g. airport, repair, pickup)");
        state.set(from, userState);
        return res.sendStatus(200);
      }

      if (userState.step === 3) {
        userState.need = textRaw;
        userState.step = 4;

        await sendSMS(from, "⏰ What time do you want it?");
        state.set(from, userState);
        return res.sendStatus(200);
      }

      if (userState.step === 4) {
        userState.time = textRaw;
        userState.step = 5;

        // SAVE TO DB
        await pool.query(
          `INSERT INTO car_leads (name, phone, postcode, need, time, status)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            userState.name,
            from,
            userState.postcode,
            userState.need,
            userState.time,
            "new",
          ]
        );

        await sendSMS(
          from,
          "✅ Perfect — your car booking request has been received. We’ll confirm shortly."
        );

        state.delete(from);
        return res.sendStatus(200);
      }

      // DEFAULT
      await sendSMS(from, "Reply BOOK to start a car booking 🚗");
      return res.sendStatus(200);
    }

    // ================= MISSED CALL =================
    if (event === "call.initiated") {
      await sendSMS(
        from,
        "🚗 We missed your call. Reply BOOK to arrange a car."
      );
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("WEBHOOK ERROR:", err);
    return res.status(500).send("error");
  }
});

// ================= HEALTH =================
app.get("/", (req, res) => {
  res.send("🚗 Cars server running");
});

// ================= START =================
app.listen(PORT, () => {
  console.log(`🚗 Cars server running on ${PORT}`);
});
