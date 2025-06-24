const express = require("express");
const PullServiceClient = require("./pullServiceClient");

const app = express();
const port = process.env.PORT || 3000;
const address = "https://rpc-testnet-dora-2.supra.com";
const chainType = "evm";
const client = new PullServiceClient(address);

const pairIndexes = [
  6004,6005,6010,6003,6011,6009,6059,6068,6001,6066,
  6006,6002,6000,5010,5000,5002,5013,5011,5012,5001,
  5501,5500,0,1,10,14,5,3,15,16,90,2
];

let latestProof = null;

async function fetchProofLoop() {
  try {
    const data = await client.getProof({ pair_indexes: pairIndexes, chain_type: chainType });
    const proof = data.proof_bytes.startsWith("0x") ? data.proof_bytes : "0x" + data.proof_bytes;
    latestProof = proof;
    console.log("✅ Proof updated.");
  } catch (err) {
    console.error("❌ Fetch error:", err?.response?.data || err.message);
  }
}

fetchProofLoop();
setInterval(fetchProofLoop, 1000);

app.get("/proof", (req, res) => {
  if (!latestProof) {
    return res.status(503).json({ error: "Proof not ready" });
  }
  res.json({ proof: latestProof });
});

app.listen(port, () => console.log(`🚀 Listening on port ${port}`));
