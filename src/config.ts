import path from "path";
import { config } from "dotenv";
import { loadVar } from "./utils/envUtils";

config({ path: path.join(__dirname, "../.env") });

export const PORT = loadVar("PORT", true);
export const PRIVATE_KEY = loadVar("PRIVATE_KEY");
// export const CONTRACT_ADDRESS = loadVar("CONTRACT_ADDRESS");
// export const NODE_URL = loadVar("NODE_URL");
export const MARKET = loadVar("MARKET");
export const INDEXER_API_URL = loadVar("INDEXER_API_URL");
export const SPOT_MARKET_ID = loadVar("SPOT_MARKET_ID");
