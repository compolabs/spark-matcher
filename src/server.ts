import { MARKET, PORT, PRIVATE_KEY } from "./config";
import { app } from "./app";
import { Provider, Wallet, sleep } from "fuels";
import { INDEXER_URL, TOKENS_BY_SYMBOL } from "./constants";
import Spark, { BETA_NETWORK, BETA_CONTRACT_ADDRESSES, BN } from "@compolabs/spark-ts-sdk";

enum STATUS {
  ACTIVE,
  CHILL,
}

class SparkMatcher {
  sdk: Spark;
  initialized = false;
  private status = STATUS.CHILL;
  fails: Record<string, number> = {};

  constructor() {
    this.sdk = new Spark({
      networkUrl: BETA_NETWORK.url,
      contractAddresses: BETA_CONTRACT_ADDRESSES,
      indexerApiUrl: INDEXER_URL,
    });

    new Promise(async (resolve) => {
      const provider = await Provider.create(BETA_NETWORK.url);
      const wallet = Wallet.fromPrivateKey(PRIVATE_KEY, provider);
      this.sdk.setActiveWallet(wallet);
      resolve(true);
    }).then(() => {
      console.log("🐅 Spark Matcher is ready to spark match!");
      this.initialized = true;
    });
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

    for (let i = 0; i < sellOrders.length; ++i) {
      const sellOrder = sellOrders[i];
      if (sellOrder.baseSize.eq(0)) continue;
      if (this.fails[sellOrder.id] > 5) {
        // console.log("⚠️ skipped because of a lot of fails");
        continue;
      }
      for (let j = 0; j < buyOrders.length; ++j) {
        const buyOrder = buyOrders[j];
        if (buyOrder.baseSize.eq(0)) continue;
        if (
          sellOrder.baseToken === buyOrder.baseToken &&
          sellOrder.orderPrice.lte(buyOrder.orderPrice) &&
          sellOrder.baseSize.lt(0) &&
          buyOrder.baseSize.gt(0)
        ) {
          if (this.fails[buyOrder.id] > 5 || this.fails[sellOrder.id] > 5) {
            // console.log("⚠️ skipped because of a lot of fails");
            continue;
          }

          const [sell_res, buy_res] = await Promise.all([
            this.sdk.fetchSpotOrderById(sellOrder.id),
            this.sdk.fetchSpotOrderById(buyOrder.id),
          ]);

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
          await this.sdk
            .matchSpotOrders(sellOrder.id, buyOrder.id)
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
