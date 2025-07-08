const express = require("express");
const cors = require("cors");
const PullServiceClient = require("./pullServiceClient");

const app = express();
const port = process.env.PORT || 3000;

// Active CORS pour toutes les origines
app.use(cors());
app.options("*", cors());

const address = "https://rpc-testnet-dora-2.supra.com";
const chainType = "evm";
const client = new PullServiceClient(address);

// Cache avec expiration (clé = pairIndexes.join(","), valeur = { proof, timestamp })
const cache = new Map();

async function fetchProof(pairIndexes) {
  try {
    const key = pairIndexes.sort((a, b) => a - b).join(",");
    const cached = cache.get(key);
    const now = Date.now();

    // ❗ Vérifie si cache existe et s'il a moins de 1000ms
    if (cached && now - cached.timestamp < 1000) {
      return cached.proof;
    }

    const data = await client.getProof({ pair_indexes: pairIndexes, chain_type: chainType });
    const proof = data.proof_bytes.startsWith("0x") ? data.proof_bytes : "0x" + data.proof_bytes;

    // Met à jour le cache avec timestamp
    cache.set(key, { proof, timestamp: now });

    return proof;
  } catch (err) {
    console.error("❌ Fetch error:", err?.response?.data || err.message);
    throw err;
  }
}

app.get("/proof", async (req, res) => {
  try {
    const query = req.query.pairs;
    if (!query) return res.status(400).json({ error: "Missing ?pairs=0,1,2" });

    const pairIndexes = query
      .split(",")
      .map((s) => parseInt(s.trim()))
      .filter((n) => !isNaN(n));

    if (pairIndexes.length === 0) {
      return res.status(400).json({ error: "No valid pair indexes" });
    }

    const proof = await fetchProof(pairIndexes);
    res.json({ proof });
  } catch (e) {
    res.status(503).json({ error: "Failed to fetch proof" });
  }
});

app.listen(port, () => console.log(`🚀 Listening on port ${port}`));

