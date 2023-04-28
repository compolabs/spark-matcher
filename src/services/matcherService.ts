import { Wallet } from "fuels";
import { contractAddress, nodeUrl, privateKey } from "../config";
import { LimitOrdersAbi__factory } from "../constants/limitOrdersConstants/LimitOrdersAbi__factory";
import { LimitOrdersAbi } from "../constants/limitOrdersConstants/LimitOrdersAbi";
import { Order } from "../models/Order";
import { TOKENS_BY_SYMBOL } from "../constants";
import BN from "../utils/BN";
import splitArrayIntoChunks from "../utils/splitArrayIntoChunks";

export const initMatcher = (): LimitOrdersAbi | null => {
  const wallet = Wallet.fromPrivateKey(privateKey, nodeUrl);
  const limitOrdersContract = LimitOrdersAbi__factory.connect(contractAddress, wallet);
  if (wallet == null || limitOrdersContract == null) return null;
  return limitOrdersContract;
};

export const matchOrders = async (limitOrders: LimitOrdersAbi) => {
  const usdc = TOKENS_BY_SYMBOL.USDC;
  const btc = TOKENS_BY_SYMBOL.BTC;
  const fulfilledBuyOrders: string[] = [];
  const fulfilledSellOrders: string[] = [];
  const ordersToMatch: { sellOrder: string; buyOrder: string }[] = [];
  const [sellActiveOrders, buyActiveOrders] = await Promise.all([
    Order.find({
      status: "Active",
      asset0: btc.assetId,
      asset1: usdc.assetId,
    }).exec(),
    Order.find({
      status: "Active",
      asset0: usdc.assetId,
      asset1: btc.assetId,
    }).exec(),
  ]);
  if (sellActiveOrders.length == 0 || buyActiveOrders.length == 0) return;
  for (let i = 0; i < sellActiveOrders.length; i++) {
    const orderA = sellActiveOrders[i];
    for (let j = 0; j < buyActiveOrders.length; j++) {
      const orderB = buyActiveOrders[j];
      const buyOrderPrice = new BN(orderB.price);
      const sellOrderPrice = new BN(orderA.price);
      if (
        buyOrderPrice.gte(sellOrderPrice) &&
        !fulfilledSellOrders.includes(orderA.id) &&
        !fulfilledBuyOrders.includes(orderB.id)
      ) {
        fulfilledBuyOrders.push(orderB.id);
        fulfilledSellOrders.push(orderA.id);
        ordersToMatch.push({ sellOrder: orderA.id, buyOrder: orderB.id });
        i++;
        j++;
      }
      j++;
    }
  }
  if (ordersToMatch.length == 0) return;
  try {
    console.log("ordersToMatch", ordersToMatch.length);
    const chunks = splitArrayIntoChunks(ordersToMatch, 5);
    // const data = await limitOrders
    //   .multiCall(
    //     ordersToMatch.map((o) => limitOrders.functions.match_orders(o.buyOrder, o.sellOrder))
    //   )
    //   .txParams({ gasPrice: 1 })
    //   .call();
    const data = await Promise.all(
      chunks.map((arr) =>
        limitOrders
          .multiCall(arr.map((o) => limitOrders.functions.match_orders(o.buyOrder, o.sellOrder)))
          .txParams({ gasPrice: 1 })
          .call()
      )
    );

    //const data = await Promise.all(
    //       ordersToMatch.map((o) =>
    //         limitOrders.functions.match_orders(o.buyOrder, o.sellOrder).txParams({ gasPrice: 1 }).call()
    //       )
    //     );
    console.log("data", data);
  } catch (e) {
    console.log(e);
  }
  console.log("finished matching");
};
