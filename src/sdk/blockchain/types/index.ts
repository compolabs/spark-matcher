import BN from "../../utils/BN";

export enum NETWORK {
  EVM = "EVM",
  FUEL = "FUEL",
}

export type FetchOrdersParams<T = string> = {
  baseToken: T;
  limit: number;
  trader?: T;
  orderType?: "buy" | "sell";
  isOpened?: boolean;
};

export type FetchTradesParams<T = string> = {
  baseToken: T;
  limit: number;
  trader: T;
};

export type MarketCreateEvent = {
  id: string;
  assetId: string;
  decimal: number;
};

export type SpotMarketVolume = {
  low: BN;
  high: BN;
  volume: BN;
};
