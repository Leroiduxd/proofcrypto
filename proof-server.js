const express = require("express");
const cors = require("cors");
const PullServiceClient = require("./pullServiceClient");

const app = express();
const port = process.env.PORT || 3000;

// Active CORS pour toutes les origines
app.use(cors());
// Autorise aussi les pré-requêtes (OPTIONS) sur toutes les routes
app.options("*", cors());

const address = "https://rpc-testnet-dora-2.supra.com";
const chainType = "evm";
const client = new PullServiceClient(address);

const cache = new Map(); // cache des preuves par combinaison de paires

async function fetchProof(pairIndexes) {
  try {
    const key = pairIndexes.sort((a, b) => a - b).join(",");
    if (cache.has(key)) {
      return cache.get(key);
    }

    const data = await client.getProof({ pair_indexes: pairIndexes, chain_type: chainType });
    const proof = data.proof_bytes.startsWith("0x") ? data.proof_bytes : "0x" + data.proof_bytes;
    cache.set(key, proof);
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


