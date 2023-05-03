import { contractAddress, nodeUrl, port, privateKey } from "./config";
import { Wallet } from "fuels";
import { initMongo } from "./services/mongoService";
import { LimitOrdersAbi__factory } from "./constants/limitOrdersConstants/LimitOrdersAbi__factory";
import { schedule } from "node-cron";
import { Order } from "./models/Order";
import { app } from "./app";
enum STATUS {
  RUNNING,
  CHILLED,
}

const okErrors = ["Types/values length mismatch during decode"];
class SparkMatcher {
  // private fetcher = new OrdersFetcher();
  private wallet = Wallet.fromPrivateKey(privateKey, nodeUrl);
  private limitOrdersContract = LimitOrdersAbi__factory.connect(contractAddress, this.wallet);
  private initialized = false;
  private status = STATUS.CHILLED;
  private processing: number[] = [];
  run(cronExpression: string) {
    initMongo()
      // .then(this.fetcher.init)
      .then(() => (this.initialized = true))
      .then(() =>
        schedule(cronExpression, async () => {
          if (this.status === STATUS.CHILLED) {
            this.status = STATUS.RUNNING;
            new Promise(this.doMatch)
              // .then(this.fetcher.sync)
              .catch(console.log)
              .finally(() => {
                this.processing = [];
                this.status = STATUS.CHILLED;
              });
          } else {
            console.log("🍃 Job already running, skip");
          }
        }).start()
      );
  }

  public doMatch = async (resolve: (v?: any) => void, reject: (v?: any) => void) => {
    console.log("🛫 Job start");
    const promises = [];
    if (!this.initialized) throw new Error("SparkMatcher is not initialized");
    // const activeOrders = this.fetcher.activeOrders;
    const activeOrders = await Order.find({ status: "Active" });
    for (let i in activeOrders) {
      for (let j in activeOrders) {
        const [order0, order1] = [activeOrders[i], activeOrders[j]];
        if (
          ((order0.type === "BUY" && order1.type === "SELL" && order1.price <= order0.price) ||
            (order1.type === "BUY" && order0.type === "SELL" && order0.price <= order1.price)) &&
          order0.status === "Active" &&
          order1.status === "Active" &&
          // && this.processing.indexOf(order0.id) === -1
          this.processing.indexOf(order1.id) === -1
        ) {
          const isOrdersActive = await Order.find({ id: { $in: [order0.id, order1.id] } })
            .select({ _id: false, status: true })
            .then((orders) => orders.length === 2 && orders.every((o) => o.status === "Active"));
          if (isOrdersActive) {
            this.processing.push(order0.id);
            this.processing.push(order1.id);
            const promise = this.limitOrdersContract.functions
              .match_orders(order0.id, order1.id)
              .txParams({ gasPrice: 1 })
              .call()
              .then(() => console.log(`✅ ${order0.id} + ${order1.id}`))
              .catch((e) => {
                if (e.reason) {
                  const status = okErrors.includes(e.reason) ? "✅" : "❌";
                  console.log(`${status} ${order0.id} + ${order1.id} ${e.reason}`);
                } else if (e.name && e.cause && e.cause.logs && e.cause.logs[0]) {
                  console.log(
                    `❌ ${order0.id} + ${order1.id}: ${e.name}: ${e.cause.logs[0] ?? ""}`
                  );
                } else if (/"reason": "(.+)"/.test(e.toString())) {
                  const reason = e.toString().match('"reason": "(.+)"')[1];
                  console.log(`❌ ${order0.id} + ${order1.id}: ${reason}`);
                } else {
                  console.log(`❌ ${order0.id} + ${order1.id}: ${e.toString()}`);
                  Object.entries(e);
                }
              })
              .finally(() => {
                const index0 = this.processing.indexOf(order0.id);
                const index1 = this.processing.indexOf(order1.id);
                index0 !== -1 && this.processing.splice(index0, 1);
                index1 !== -1 && this.processing.splice(index1, 1);
              });
            promises.push(promise);
          }
        }
      }
    }
    setTimeout(() => {
      // console.log("🔴 Job stopped due to timeout");
      reject("🔴 Job stopped due to timeout");
    }, 30 * 1000);

    await Promise.all(promises).then(() => {
      console.log("🏁 Job finish");
      resolve();
    });
  };
}

const matcher = new SparkMatcher();
matcher.run("*/5 * * * * *");

app.listen(port ?? 5000, () => {
  console.log("🚀 Server ready at: http://localhost:" + port);
});
