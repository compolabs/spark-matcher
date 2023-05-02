import { contractAddress, nodeUrl, port, privateKey } from "./config";
import { sleep, Wallet } from "fuels";
import OrdersFetcher from "./services/ordersFetcher";
import { initMongo } from "./services/mongoService";
import { LimitOrdersAbi__factory } from "./constants/limitOrdersConstants/LimitOrdersAbi__factory";
import { schedule } from "node-cron";
import { Order } from "./models/Order";
import { app } from "./app";

class SparkMatcher {
  private fetcher = new OrdersFetcher();
  private wallet = Wallet.fromPrivateKey(privateKey, nodeUrl);
  private limitOrdersContract = LimitOrdersAbi__factory.connect(contractAddress, this.wallet);
  private initialized = false;

  run(cronExpression: string) {
    initMongo()
      .then(this.fetcher.init)
      .then(() => (this.initialized = true))
      .then(() => schedule(cronExpression, () => this.doMatch().then(this.fetcher.sync)).start());
  }

  public doMatch = async () => {
    console.log("🛫 Job start");
    const promises = [];
    if (!this.initialized) throw new Error("SparkMatcher is not initialized");
    const activeOrders = this.fetcher.activeOrders;
    for (let i in activeOrders) {
      for (let j in activeOrders) {
        const [order0, order1] = [activeOrders[i], activeOrders[j]];
        if (
          ((order0.type === "BUY" && order1.type === "SELL" && order1.price <= order0.price) ||
            (order1.type === "BUY" && order0.type === "SELL" && order0.price <= order1.price)) &&
          order0.status === "Active" &&
          order1.status === "Active"
        ) {
          await sleep(1);
          const isOrdersActive = await Order.find({ id: { $in: [order0.id, order1.id] } })
            .select({ _id: false, status: true })
            .then((orders) => orders.length === 2 && orders.every((o) => o.status === "Active"));
          if (isOrdersActive) {
            const promise = this.limitOrdersContract.functions
              .match_orders(order0.id, order1.id)
              .txParams({ gasPrice: 1 })
              .call()
              .then(() => console.log(`✅ ${order0.id} + ${order1.id}`))
              .catch((e) => {
                if (e.reason) {
                  console.log(`❌ ${order0.id} + ${order1.id}: ${e.reason}`);
                } else if (e.name) {
                  console.log(`❌ ${order0.id} + ${order1.id}: ${e.name} ${e.cause?.logs ?? ""}`);
                } else {
                  console.log(`❌ ${order0.id} + ${order1.id}: ${e.toString()}`);
                }
              });
            promises.push(promise);
          }
        }
      }
    }
    await Promise.all(promises);
    console.log("🏁 Job finish");
  };
}

const matcher = new SparkMatcher();
matcher.run("*/30 * * * * *");

app.listen(port ?? 5000, () => {
  console.log("🚀 Server ready at: http://localhost:" + port);
});
