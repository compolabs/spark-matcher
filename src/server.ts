import { MARKET, PORT, PRIVATE_KEY } from "./config";
import { app } from "./app";
import { schedule } from "node-cron";
import { CONTRACT_ADDRESSES, TOKENS_BY_SYMBOL } from "./sdk/blockchain/fuel/constants";
import { FuelNetwork } from "./sdk/blockchain/fuel";
import { sleep } from "fuels";

export const NETWORK = {
  name: "Fuel",
  url: "https://beta-5.fuel.network/graphql",
};

class SparkMatcher {
  sdk: FuelNetwork;
  initialized = false;

  constructor() {
    this.sdk = new FuelNetwork();
    this.sdk.connectWalletByPrivateKey(PRIVATE_KEY).then(() => (this.initialized = true));
  }

  run(cronExpression: string) {
    sleep(1000).then(() => {
      // this.doMatch().catch((error) => console.error("Error in initial doMatch call:", error));
      schedule(cronExpression, async () => {
        if (this.initialized) {
          await this.doMatch();
        }
      }).start();
    });
  }

  public doMatch = async () => {
    const baseToken = TOKENS_BY_SYMBOL[MARKET].assetId;
    let [buyOrders, sellOrders]: [any[], any[]] = await Promise.all([
      this.sdk.fetchSpotOrders({ baseToken, limit: 100, orderType: "buy", isOpened: true }),
      this.sdk.fetchSpotOrders({ baseToken, limit: 100, orderType: "sell", isOpened: true }),
    ]);

    for (let i = 0; i < sellOrders.length; ++i) {
      let sellOrder = sellOrders[i];
      if (sellOrder.baseSize.eq(0)) continue;
      for (let j = 0; j < buyOrders.length; ++j) {
        let buyOrder = buyOrders[j];
        if (buyOrder.baseSize.eq(0)) continue;
        if (
          sellOrder.baseToken === buyOrder.baseToken &&
          sellOrder.price.lte(buyOrder.price) &&
          sellOrder.type === "SELL" &&
          buyOrder.type === "BUY" &&
          sellOrder.baseSize.gt(0) &&
          buyOrder.baseSize.gt(0)
        ) {
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
            .then(() => console.log("Orders matched ", sellOrder.id, buyOrder.id))
            .catch((e) => console.error(e.toString()));
        }
      }
    }
  };
}

const matcher = new SparkMatcher();
const port = PORT ?? 5000;

matcher.run("*/30 * * * * *");
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
