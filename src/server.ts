import { MARKET, PORT, PRIVATE_KEY } from "./config";
import { app } from "./app";
import { CONTRACT_ADDRESSES, TOKENS_BY_SYMBOL } from "./sdk/blockchain/fuel/constants";
import { FuelNetwork } from "./sdk/blockchain/fuel";
import { sleep } from "fuels";
import { OrderbookAbi__factory } from "./sdk/blockchain/fuel/types/orderbook";
import BN from "./sdk/utils/BN";

export const NETWORK = {
  name: "Fuel",
  url: "https://beta-5.fuel.network/graphql",
};

enum STATUS {
  ACTIVE,
  CHILL,
}

class SparkMatcher {
  sdk: FuelNetwork;
  initialized = false;
  private status = STATUS.CHILL;
  fails: Record<string, number> = {};

  constructor() {
    this.sdk = new FuelNetwork();
    this.sdk.connectWalletByPrivateKey(PRIVATE_KEY).then(() => (this.initialized = true));
  }

  run() {
    this.processNext(); // Запускаем первый процесс
  }

  private async processNext() {
    if (!this.initialized) {
      setTimeout(() => this.processNext(), 1000);
      return;
    }
    if (this.status === STATUS.ACTIVE) {
      console.log("🍃 Last process is still active. Waiting for it to complete.");
      setTimeout(() => this.processNext(), 100); // Проверяем состояние каждую секунду
      return;
    }

    this.status = STATUS.ACTIVE;
    try {
      // const startTime = Date.now();
      await this.doMatch();
      // this.lastIterationDuration = (Date.now() - startTime) / 1000;
    } catch (error) {
      console.error("An error occurred:", error);
      await sleep(50000);
    } finally {
      this.status = STATUS.CHILL;
      // console.log("✅ Process completed. Starting next one.");
      this.processNext();
    }
  }

  public doMatch = async () => {
    const orderbookFactory = OrderbookAbi__factory.connect(
      CONTRACT_ADDRESSES.spotMarket,
      this.sdk.walletManager.wallet!
    );

    const baseToken = TOKENS_BY_SYMBOL[MARKET].assetId;
    const [buyOrders, sellOrders]: [any[], any[]] = await Promise.all([
      this.sdk.fetchSpotOrders({ baseToken, limit: 100, orderType: "buy", isOpened: true }),
      this.sdk.fetchSpotOrders({ baseToken, limit: 100, orderType: "sell", isOpened: true }),
    ]);

    for (let i = 0; i < sellOrders.length; ++i) {
      const sellOrder = sellOrders[i];
      if (sellOrder.baseSize.eq(0)) continue;
      // const sell_res = await orderbookFactory.functions
      //   .order_by_id(sellOrder.id)
      //   .simulate()
      //   .then((res) => decodeOrder(res.value));
      // if (sell_res == null) {
      //   console.log("👽 Phantom order sell: " + sellOrder.id);
      //   sellOrders[i].baseSize = new BN(0);
      //   this.fails[sellOrder.id] = (this.fails[sellOrder.id] ?? 0) + 1;
      //   continue;
      // }
      if (this.fails[sellOrder.id] > 5) {
        // console.log("⚠️ skipped because of a lot of fails");
        continue;
      }
      for (let j = 0; j < buyOrders.length; ++j) {
        const buyOrder = buyOrders[j];
        if (buyOrder.baseSize.eq(0)) continue;
        if (
          sellOrder.baseToken === buyOrder.baseToken &&
          sellOrder.price.lte(buyOrder.price) &&
          sellOrder.type === "SELL" &&
          buyOrder.type === "BUY" &&
          sellOrder.baseSize.gt(0) &&
          buyOrder.baseSize.gt(0)
        ) {
          if (this.fails[buyOrder.id] > 5 || this.fails[sellOrder.id] > 5) {
            // console.log("⚠️ skipped because of a lot of fails");
            continue;
          }

          const [sell_res, buy_res] = await Promise.all([
            orderbookFactory.functions.order_by_id(sellOrder.id).simulate(),
            orderbookFactory.functions.order_by_id(buyOrder.id).simulate(),
          ]).then((res) => res.map((res) => decodeOrder(res.value)));

          if (buy_res == null) {
            console.log("👽 Phantom order buy: " + buyOrder.id);
            buyOrders[i].baseSize = new BN(0);
            this.fails[buyOrder.id] = (this.fails[buyOrder.id] ?? 0) + 1;
            continue;
          }
          if (sell_res == null) {
            console.log("👽 Phantom order sell: " + sellOrder.id);
            sellOrders[i].baseSize = new BN(0);
            this.fails[sellOrder.id] = (this.fails[sellOrder.id] ?? 0) + 1;
            continue;
          }
          await this.sdk.api
            .matchSpotOrders(
              sellOrder.id,
              buyOrder.id,
              this.sdk.walletManager.wallet!,
              CONTRACT_ADDRESSES.spotMarket
            )
            .then(() => {
              const amount =
                sellOrder.baseSize > buyOrder.baseSize ? buyOrder.baseSize : sellOrder.baseSize;

              sellOrder.baseSize = sellOrder.baseSize.minus(amount);
              sellOrders[i].baseSize = sellOrder.baseSize;

              buyOrder.baseSize = buyOrder.baseSize.minus(amount);
              buyOrders[i].baseSize = buyOrder.baseSize;
            })
            .then(() => console.log("✅ Orders matched ", sellOrder.id, buyOrder.id, "\n"))
            .catch((e) => {
              console.error(e.toString(), "\n");
              console.log(sell_res, buy_res);
              this.fails[sellOrder.id] = (this.fails[sellOrder.id] ?? 0) + 1;
              this.fails[buyOrder.id] = (this.fails[buyOrder.id] ?? 0) + 1;
            });
          await sleep(100);
          this.fails = {};
        }
      }
    }
  };
}

const matcher = new SparkMatcher();
const port = PORT ?? 5000;

sleep(1000).then(() => matcher.run());

const print = `
 ██████╗ ██████╗ ███╗   ███╗██████╗  ██████╗ ███████╗ █████╗ ██████╗ ██╗██╗     ██╗████████╗██╗   ██╗
██╔════╝██╔═══██╗████╗ ████║██╔══██╗██╔═══██╗██╔════╝██╔══██╗██╔══██╗██║██║     ██║╚══██╔══╝╚██╗ ██╔╝
██║     ██║   ██║██╔████╔██║██████╔╝██║   ██║███████╗███████║██████╔╝██║██║     ██║   ██║    ╚████╔╝ 
██║     ██║   ██║██║╚██╔╝██║██╔═══╝ ██║   ██║╚════██║██╔══██║██╔══██╗██║██║     ██║   ██║     ╚██╔╝  
╚██████╗╚██████╔╝██║ ╚═╝ ██║██║     ╚██████╔╝███████║██║  ██║██████╔╝██║███████╗██║   ██║      ██║   
 ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝      ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚══════╝╚═╝   ╚═╝      ╚═╝   
                                                                                                     
██╗      █████╗ ██████╗ ███████╗                                                                     
██║     ██╔══██╗██╔══██╗██╔════╝                                                                     
██║     ███████║██████╔╝███████╗                                                                     
██║     ██╔══██║██╔══██╗╚════██║                                                                     
███████╗██║  ██║██████╔╝███████║                                                                     
╚══════╝╚═╝  ╚═╝╚═════╝ ╚══════╝                                                                     
                                                                                                     
🚀 Server ready at: http://localhost:${port}
`;
app.listen(PORT ?? 5000, () => console.log(print));

function decodeOrder(order: any) {
  return order != null
    ? {
        id: order.id,
        trader: order.trader.value,
        base_token: order.base_token.value,
        base_size: (order.base_size.negative ? "-" : "") + order.base_size.value.toString(),
        base_price: order.base_price.toString(),
      }
    : null;
}
