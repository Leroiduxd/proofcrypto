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

/**
 * Fetch or return cached proof for given pair indexes
 */
async function fetchProof(pairIndexes) {
  const key = pairIndexes.sort((a, b) => a - b).join(",");
  const now = Date.now();
  const cached = cache.get(key);

  if (cached && now - cached.timestamp < 1000) {
    console.log(`🔄 [Cache] Returning cached proof for pairs=[${key}] (age=${now - cached.timestamp}ms)`);
    return cached.proof;
  }

  console.log(`🌐 [Fetch] Requesting new proof for pairs=[${key}]`);
  try {
    const data = await client.getProof({ pair_indexes: pairIndexes, chain_type: chainType });
    const proofBytes = data.proof_bytes;
    const proof = proofBytes.startsWith("0x") ? proofBytes : "0x" + proofBytes;

    cache.set(key, { proof, timestamp: now });
    console.log(`✅ [Fetch] Cached new proof for pairs=[${key}]`);
    return proof;
  } catch (err) {
    console.error("❌ [Fetch Error] Failed to fetch proof for pairs=[${key}]:", err?.response?.data || err.message);
    throw err;
  }
}

// Endpoint de l'API
app.get("/proof", async (req, res) => {
  const query = req.query.pairs;
  console.log(`📨 [Request] /proof called with pairs=${query}`);

  if (!query) {
    console.warn("⚠️ [Request] Missing ?pairs parameter");
    return res.status(400).json({ error: "Missing ?pairs=0,1,2" });
  }

  const pairIndexes = query
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));

  if (pairIndexes.length === 0) {
    console.warn(`⚠️ [Request] No valid pair indexes in '${query}'`);
    return res.status(400).json({ error: "No valid pair indexes" });
  }

  try {
    const proof = await fetchProof(pairIndexes);
    console.log(`📤 [Response] Sending proof for pairs=[${pairIndexes.join(",")}]`);
    res.json({ proof });
  } catch (e) {
    console.error(`❌ [Response Error] Could not get proof for pairs=[${pairIndexes.join(",")}]`);
    res.status(503).json({ error: "Failed to fetch proof" });
  }
});

app.listen(port, () => console.log(`🚀 Listening on port ${port}`));
