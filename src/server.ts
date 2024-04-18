import { MARKET, PORT, PRIVATE_KEY } from "./config";
import { app } from "./app";
import { Wallet, sleep } from "fuels";
import Spark, { BN } from "spark-ts-sdk";
import { NETWORK, CONTRACT_ADDRESSES, INDEXER_URL, TOKENS_BY_SYMBOL } from "./constants";
import { SpotOrder } from "spark-ts-sdk/dist/interface";

enum STATUS {
  ACTIVE,
  CHILL,
}

class SparkMatcher {
  sdk: Spark;
  initialized = false;
  private status = STATUS.CHILL;

  constructor() {
    const wallet = Wallet.fromPrivateKey(PRIVATE_KEY);

    this.sdk = new Spark({
      networkUrl: NETWORK.url,
      contractAddresses: CONTRACT_ADDRESSES,
      indexerApiUrl: INDEXER_URL,
      wallet,
    });

    this.initialized = true;
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
    const baseToken = TOKENS_BY_SYMBOL[MARKET].address;

    const [buyOrders, sellOrders] = await Promise.all([
      this.sdk.fetchSpotOrders({ baseToken, limit: 100, type: "BUY", isActive: true }),
      this.sdk.fetchSpotOrders({ baseToken, limit: 100, type: "SELL", isActive: true }),
    ]);

    // for (let i = 0; i < sellOrders.length; ++i) {
    //   const sellOrder = sellOrders[i];
    //   if (sellOrder.baseSize.eq(0)) continue;
    //   for (let j = 0; j < buyOrders.length; ++j) {
    //     const buyOrder = buyOrders[j];
    //     if (buyOrder.baseSize.eq(0)) continue;
    //     if (
    //       sellOrder.baseToken === buyOrder.baseToken &&
    //       sellOrder.orderPrice.lte(buyOrder.orderPrice) &&
    //       sellOrder.baseSize.lt(0) &&
    //       buyOrder.baseSize.gt(0)
    //     ) {
    //       const [sell_res, buy_res] = await Promise.all([
    //         this.sdk.fetchSpotOrderById(sellOrder.id),
    //         this.sdk.fetchSpotOrderById(buyOrder.id),
    //       ]);

    //       if (sell_res == null) {
    //         console.log("👽 Phantom orders: " + sellOrder.id);
    //         sellOrders[i].baseSize = new BN(0); // ?
    //         continue;
    //       }
    //       if (buy_res == null) {
    //         console.log("👽 Phantom orders: " + buyOrder.id);
    //         buyOrders[i].baseSize = new BN(0); // ?
    //         continue;
    //       }
    //       await this.sdk
    //         .matchSpotOrders(sellOrder.id, buyOrder.id)
    //         // ?
    //         .then(() => {
    //           const amount =
    //             sellOrder.baseSize > buyOrder.baseSize ? buyOrder.baseSize : sellOrder.baseSize;

    //           sellOrder.baseSize = sellOrder.baseSize.minus(amount);
    //           sellOrders[i].baseSize = sellOrder.baseSize;

    //           buyOrder.baseSize = buyOrder.baseSize.minus(amount);
    //           buyOrders[i].baseSize = buyOrder.baseSize;
    //         })
    //         .then(() => console.log("✅ Orders matched ", sellOrder.id, buyOrder.id, "\n"))
    //         .catch((e) => {
    //           // console.log(this.sdk.decodeSpotReceipts([e.receipt]));
    //           console.error(sellOrder.id, buyOrder.id, "\n", e.toString(), "\n");
    //         });
    //       await sleep(100);
    //     }
    //   }
    // }

    await this.matchOrders(sellOrders, buyOrders);
  };

  private matchOrders = async (sellOrders: SpotOrder[], buyOrders: SpotOrder[]) => {
    sellOrders.sort((a, b) => {
      if (a.orderPrice.lt(b.orderPrice)) return -1;
      if (a.orderPrice.gt(b.orderPrice)) return 1;
      return 0;
    });
    buyOrders.sort((a, b) => {
      if (a.orderPrice.gt(b.orderPrice)) return -1;
      if (a.orderPrice.lt(b.orderPrice)) return 1;
      return 0;
    });

    let i = 0;
    let j = 0;

    while (i < sellOrders.length && j < buyOrders.length) {
      const sellOrder = sellOrders[i];
      const buyOrder = buyOrders[j];

      if (sellOrder.baseSize.eq(0)) {
        i++;
        continue;
      }
      if (buyOrder.baseSize.eq(0)) {
        j++;
        continue;
      }

      if (sellOrder.orderPrice.lte(buyOrder.orderPrice)) {
        try {
          const [sell_res, buy_res] = await Promise.all([
            this.sdk.fetchSpotOrderById(sellOrder.id),
            this.sdk.fetchSpotOrderById(buyOrder.id),
          ]);

          if (!sell_res) {
            console.log("👽 Phantom orders: " + sellOrder.id);
            sellOrder.baseSize = new BN(0); // ?
            i++;
            continue;
          }
          if (!buy_res) {
            console.log("👽 Phantom orders: " + sellOrder.id);
            buyOrder.baseSize = new BN(0); // ?
            j++;
            continue;
          }
        } catch (e) {
          console.error(`Error fetching orders ${sellOrder.id} and ${buyOrder.id}: ${e}`);
          continue;
        }

        try {
          await this.sdk.matchSpotOrders(sellOrder.id, buyOrder.id);
          const matchAmount = sellOrder.baseSize.gt(buyOrder.baseSize)
            ? buyOrder.baseSize
            : sellOrder.baseSize;

          sellOrder.baseSize = sellOrder.baseSize.minus(matchAmount);
          buyOrder.baseSize = buyOrder.baseSize.minus(matchAmount);

          if (sellOrder.baseSize.eq(0)) {
            i++;
          }
          if (buyOrder.baseSize.eq(0)) {
            j++;
          }
        } catch (e) {
          console.error(`Error matching orders ${sellOrder.id} and ${buyOrder.id}: ${e}`);
        }
      } else {
        break;
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
