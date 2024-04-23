import TOKENS_JSON from "./tokens.json";

export const NETWORK = {
  name: "Fuel",
  url: "https://beta-5.fuel.network/graphql",
};

export const CONTRACT_ADDRESSES = {
  spotMarket: "0x0f0c1065a7b82d026069c5cf070b21ee65713fd1ac92ec1d25eacc3100187f78",
  tokenFactory: "0x6bd9643c9279204b474a778dea7f923226060cb94a4c61c5aae015cf96b5aad2",
  vault: "0x0030b0d258fb536aeb70d12409b6f3fde17541e3d02570cf53cd3f0944729a3d",
  accountBalance: "0xbd200b0e96f70737ed8f039ca81c45c1ec8ee75ede376f793c2d8c27ec592377",
  clearingHouse: "0xc8fb5aa5b1129d7f168571768d65a5b25f6451170397a13bb21896f111ca4633",
  perpMarket: "0x458255214c7d2b4a6c605317f8bf924fe0617ffc6a0c488693189adbf14441ff",
  pyth: "0x3cd5005f23321c8ae0ccfa98fb07d9a5ff325c483f21d2d9540d6897007600c9",
  proxy: "0x7f94d112735a20c0374501b1dd3dc83c624db84feb48c546e7698a6d95177b64",
};

export const EXPLORER_URL = "https://fuellabs.github.io/block-explorer-v2/beta-5";

interface Asset {
  address: string;
  symbol: string;
  decimals: number;
}

export const TOKENS_LIST: Asset[] = Object.values(TOKENS_JSON).map(
  ({ decimals, assetId, symbol }) => ({
    address: assetId,
    symbol,
    decimals,
  })
);

export const TOKENS_BY_SYMBOL: Record<string, Asset> = TOKENS_LIST.reduce(
  (acc, t) => ({ ...acc, [t.symbol]: t }),
  {}
);

export const TOKENS_BY_ASSET_ID: Record<string, Asset> = TOKENS_LIST.reduce(
  (acc, t) => ({ ...acc, [t.address.toLowerCase()]: t }),
  {}
);

export const INDEXER_URL = "https://indexer.spark-defi.com";
