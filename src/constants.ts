import { BETA_TOKENS } from "spark-ts-sdk";

interface Asset {
  address: string;
  symbol: string;
  decimals: number;
}

export const TOKENS_LIST: Asset[] = Object.values(BETA_TOKENS).map(
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
