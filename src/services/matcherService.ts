import { sleep, Wallet } from "fuels";
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
    })
      .sort({ price: 1 })
      .limit(1000)
      .exec(),
    Order.find({
      status: "Active",
      asset0: usdc.assetId,
      asset1: btc.assetId,
    })
      .sort({ price: -1 })
      .limit(1000)
      .exec(),
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

  const chunks = splitArrayIntoChunks(ordersToMatch, 5);
  for (let c = 0; c < chunks.length; c++) {
    const chunk = chunks[c];
    await Promise.all(
      chunk.map((o) =>
        limitOrders.functions.match_orders(o.buyOrder, o.sellOrder).txParams({ gasPrice: 1 }).call()
      )
    )
      .then(() => c++)
      .catch((e) => console.log("error", e.toString().slice(0, 50)))
      .then(() =>
        Promise.all(
          chunk.map((o) =>
            limitOrders.functions
              .match_orders(o.buyOrder, o.sellOrder)
              .txParams({ gasPrice: 1 })
              .call()
          )
        )
          .then(() => c++)
          .catch((e) => console.log("final error", e.toString().slice(0, 100)))
      );
    await sleep(100);
  }

  console.log("finished matching");
};
