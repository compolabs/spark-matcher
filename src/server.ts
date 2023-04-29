import mongoose from "mongoose";
import { contractAddress, mongoUrl, nodeUrl, privateKey } from "./config";
import { initMatcher } from "./services/matcherService";
import { sleep, Wallet } from "fuels";
import OrdersFetcher from "./services/ordersFetcher";
import { initMongo } from "./services/mongoService";
import { LimitOrdersAbi__factory } from "./constants/limitOrdersConstants/LimitOrdersAbi__factory";
import { schedule } from "node-cron";
import { Order } from "./models/Order";

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
    if (!this.initialized) throw new Error("SparkMatcher is not initialized");
    const activeOrders = this.fetcher.activeOrders;
    for (let i in activeOrders) {
      for (let j in activeOrders) {
        const [order0, order1] = activeOrders;
        const isActive = (id: number) =>
          Order.findOne({ id })
            .select({ _id: false, status: true })
            .then((order) => order?.status === "Active");
        if (
          (order0.type === "BUY" && order1.type === "SELL" && order1.price <= order0.price) ||
          (order1.type === "BUY" && order0.type === "SELL" && order0.price <= order1.price)
        ) {
          const res = await Promise.all([isActive(order0.id), isActive(order1.id)]);
          res.every((v) => v) &&
            this.limitOrdersContract.functions
              .match_orders(order0.id, order1.id)
              .txParams({ gasPrice: 1 })
              .call()
              .then(() => console.log(`✅ ${order0.id} + ${order1.id}`))
              .catch((e) => console.log(e.toString()));
          await sleep(1);
        }
      }
    }
  };
}

const matcher = new SparkMatcher();
matcher.run("*/10 * * * * *");
