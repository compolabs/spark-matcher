import { Address, Bech32Address, WalletLocked, WalletUnlocked } from "fuels";

import { SpotMarketOrder, SpotMarketTrade, Token } from "../../entity";
import { PerpMarket } from "../../entity/PerpMarket";
import { PerpOrder } from "../../entity/PerpOrder";
import { PerpPosition } from "../../entity/PerpPosition";
import BN from "../../utils/BN";
import {
  FetchOrdersParams,
  FetchTradesParams,
  MarketCreateEvent,
  SpotMarketVolume,
} from "../types";

import { AccountBalanceAbi__factory } from "./types/account-balance";
import { ClearingHouseAbi__factory } from "./types/clearing-house";
import { OrderbookAbi__factory } from "./types/orderbook";
import { PerpMarketAbi__factory } from "./types/perp-market";
import { VaultAbi__factory } from "./types/vault";
import { AddressInput, AssetIdInput } from "./types/vault/VaultAbi";
import { CONTRACT_ADDRESSES, INDEXER_URL, TOKENS_BY_SYMBOL } from "./constants";
import { convertI64ToBn } from "./utils";
import axios from "axios";
import { URLSearchParams } from "url";

export class Fetch {
  fetchSpotMarkets = async (
    limit: number,
    tokens: Token[],
    wallet: WalletLocked | WalletUnlocked
  ): Promise<MarketCreateEvent[]> => {
    const orderbookFactory = OrderbookAbi__factory.connect(CONTRACT_ADDRESSES.spotMarket, wallet);

    const getMarketByIdPromises = tokens.map((t) =>
      orderbookFactory.functions
        .get_market_by_id({
          value: t.assetId,
        })
        .simulate()
    );

    const data = await Promise.all(getMarketByIdPromises);

    const markets = data.map((market) => ({
      id: market.value.asset_id.value,
      assetId: market.value.asset_id.value,
      decimal: market.value.asset_decimals,
    }));

    return markets;
  };

  fetchSpotMarketPrice = async (baseToken: string): Promise<BN> => {
    console.warn("[fetchMarketPrice] NOT IMPLEMENTED FOR FUEL");
    return BN.ZERO;
  };

  fetchSpotOrders = async (params: FetchOrdersParams): Promise<SpotMarketOrder[]> => {
    const validParams = Object.entries(params).filter(([, value]) => Boolean(value)) as [
      string,
      string
    ][];
    const searchParams = new URLSearchParams(validParams);
    const data = await axios
      .get(`${INDEXER_URL}/orders?${searchParams.toString()}`)
      .then((res) => res.data);

    const orders: SpotMarketOrder[] = data.map((order: any) => {
      const baseSize = new BN(order.base_size);
      const basePrice = new BN(order.base_price);
      // console.log(order);
      return new SpotMarketOrder({
        id: order.order_id,
        baseToken: order.base_token,
        trader: order.trader,
        baseSize: baseSize.toNumber(),
        orderPrice: basePrice.toNumber(),
        blockTimestamp: getUnixTime(order.createdAt),
      });
    });
    return params.orderType === "sell"
      ? orders.sort((a, b) => (a.price > b.price ? 1 : -1))
      : orders.sort((a, b) => (a.price > b.price ? -1 : 1));
  };

  fetchSpotTrades = async ({
    baseToken,
    limit,
    trader,
  }: FetchTradesParams): Promise<SpotMarketTrade[]> => {
    console.warn("[fetchTrades] NOT IMPLEMENTED FOR FUEL");
    return [];
  };

  fetchSpotVolume = async (): Promise<SpotMarketVolume> => {
    console.warn("[fetchVolume] NOT IMPLEMENTED FOR FUEL");
    return { volume: BN.ZERO, high: BN.ZERO, low: BN.ZERO };
  };

  fetchPerpCollateralBalance = async (
    accountAddress: string,
    assetAddress: string,
    wallet: WalletLocked | WalletUnlocked
  ): Promise<BN> => {
    const vaultFactory = VaultAbi__factory.connect(CONTRACT_ADDRESSES.vault, wallet);

    const addressInput: AddressInput = {
      value: new Address(accountAddress as any).toB256(),
    };

    const assetIdInput: AssetIdInput = {
      value: assetAddress,
    };

    const result = await vaultFactory.functions
      .get_collateral_balance(addressInput, assetIdInput)
      .simulate();

    const collateralBalance = new BN(result.value.toString());

    return collateralBalance;
  };

  fetchPerpAllTraderPositions = async (
    accountAddress: string,
    wallet: WalletLocked | WalletUnlocked
  ): Promise<PerpPosition[]> => {
    const accountBalanceFactory = AccountBalanceAbi__factory.connect(
      CONTRACT_ADDRESSES.accountBalance,
      wallet
    );

    const addressInput: AddressInput = {
      value: new Address(accountAddress as any).toB256(),
    };

    const result = await accountBalanceFactory.functions
      .get_all_trader_positions(addressInput)
      .simulate();

    const positions = result.value.map(
      ([assetAddress, accountBalance]) =>
        new PerpPosition({
          baseTokenAddress: assetAddress.value,
          lastTwPremiumGrowthGlobal: convertI64ToBn(accountBalance.last_tw_premium_growth_global),
          takerOpenNational: convertI64ToBn(accountBalance.taker_open_notional),
          takerPositionSize: convertI64ToBn(accountBalance.taker_position_size),
        })
    );

    return positions;
  };

  fetchPerpMarketPrice = async (
    assetAddress: string,
    wallet: WalletLocked | WalletUnlocked
  ): Promise<BN> => {
    const perpMarketFactory = PerpMarketAbi__factory.connect(CONTRACT_ADDRESSES.perpMarket, wallet);

    const assetIdInput: AssetIdInput = {
      value: assetAddress,
    };

    const result = await perpMarketFactory.functions.get_market_price(assetIdInput).simulate();

    const marketPrice = new BN(result.value.toString());

    return marketPrice;
  };

  fetchPerpFundingRate = async (
    assetAddress: string,
    wallet: WalletLocked | WalletUnlocked
  ): Promise<BN> => {
    const accountBalanceFactory = AccountBalanceAbi__factory.connect(
      CONTRACT_ADDRESSES.accountBalance,
      wallet
    );

    const assetIdInput: AssetIdInput = {
      value: assetAddress,
    };

    const result = await accountBalanceFactory.functions.get_funding_rate(assetIdInput).simulate();

    const fundingRate = convertI64ToBn(result.value);

    return fundingRate;
  };

  fetchPerpFreeCollateral = async (
    accountAddress: string,
    wallet: WalletLocked | WalletUnlocked
  ): Promise<any> => {
    const vaultFactory = VaultAbi__factory.connect(CONTRACT_ADDRESSES.vault, wallet);

    const addressInput: AddressInput = {
      value: new Address(accountAddress as any).toB256(),
    };

    const result = await vaultFactory.functions.get_free_collateral(addressInput).simulate();

    const freeCollateral = new BN(result.value.toString());

    return freeCollateral;
  };

  fetchPerpMarket = async (
    assetAddress: string,
    wallet: WalletLocked | WalletUnlocked
  ): Promise<PerpMarket> => {
    const clearingHouseFactory = ClearingHouseAbi__factory.connect(
      CONTRACT_ADDRESSES.clearingHouse,
      wallet
    );

    const assetIdInput: AssetIdInput = {
      value: assetAddress,
    };

    const result = await clearingHouseFactory.functions.get_market(assetIdInput).simulate();

    const pausedIndexPrice = result.value.paused_index_price
      ? new BN(result.value.paused_index_price.toString())
      : undefined;
    const pausedTimestamp = result.value.paused_timestamp
      ? result.value.paused_timestamp.toNumber()
      : undefined;
    const closedPrice = result.value.closed_price
      ? new BN(result.value.closed_price.toString())
      : undefined;

    const perpMarket = new PerpMarket({
      baseTokenAddress: result.value.asset_id.value,
      quoteTokenAddress: TOKENS_BY_SYMBOL["USDC"].assetId,
      imRatio: new BN(result.value.im_ratio.toString()),
      mmRatio: new BN(result.value.mm_ratio.toString()),
      status: result.value.status,
      pausedIndexPrice,
      pausedTimestamp,
      closedPrice,
    });

    return perpMarket;
  };

  fetchPerpPendingFundingPayment = async (
    accountAddress: string,
    assetAddress: string,
    wallet: WalletLocked | WalletUnlocked
  ): Promise<{ fundingPayment: BN; fundingGrowthPayment: BN }> => {
    const accountBalanceFactory = AccountBalanceAbi__factory.connect(
      CONTRACT_ADDRESSES.accountBalance,
      wallet
    );

    const addressInput: AddressInput = {
      value: new Address(accountAddress as any).toB256(),
    };

    const assetIdInput: AssetIdInput = {
      value: assetAddress,
    };

    const result = await accountBalanceFactory.functions
      .get_pending_funding_payment(addressInput, assetIdInput)
      .simulate();

    const fundingPayment = convertI64ToBn(result.value[0]);
    const fundingGrowthPayment = convertI64ToBn(result.value[1]);

    return { fundingPayment, fundingGrowthPayment };
  };

  fetchPerpIsAllowedCollateral = async (
    assetAddress: string,
    wallet: WalletLocked | WalletUnlocked
  ): Promise<boolean> => {
    const vaultFactory = VaultAbi__factory.connect(CONTRACT_ADDRESSES.vault, wallet);

    const assetIdInput: AssetIdInput = {
      value: assetAddress,
    };

    const result = await vaultFactory.functions.is_allowed_collateral(assetIdInput).simulate();

    return result.value;
  };

  fetchPerpTraderOrders = async (
    accountAddress: string,
    assetAddress: string,
    wallet: WalletLocked | WalletUnlocked
  ): Promise<PerpOrder[]> => {
    const vaultFactory = PerpMarketAbi__factory.connect(CONTRACT_ADDRESSES.perpMarket, wallet);

    const addressInput: AddressInput = {
      value: new Address(accountAddress as any).toB256(),
    };

    const assetIdInput: AssetIdInput = {
      value: assetAddress,
    };

    const result = await vaultFactory.functions
      .get_trader_orders(addressInput, assetIdInput)
      .simulate();

    const orders = result.value.map(
      (order) =>
        new PerpOrder({
          id: order.id,
          baseSize: convertI64ToBn(order.base_size),
          baseTokenAddress: order.base_token.value,
          orderPrice: new BN(order.order_price.toString()),
          trader: order.trader.value,
        })
    );

    return orders;
  };
}

function getUnixTime(time: string | number) {
  const date = new Date(time);
  return Math.floor(date.getTime() / 1000);
}
