import mongoose from "mongoose";
import { mongoUrl } from "./config";
import { initMatcher, matchOrders } from "./services/matcherService";
import { sleep } from "fuels";
import OrdersFetcher from "./services/ordersFetcher";

mongoose
  .connect(mongoUrl, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ Connected to MongoDB");
    /** ready to use. The `mongoose.connect()` promise resolves to undefined. */
  })
  .catch((err) => {
    console.log(`❌  MongoDB connection error. Please make sure MongoDB is running. ${err}`);
    // process.exit();
  });

(async () => {
  const limitOrdersContract = initMatcher();
  if (limitOrdersContract == null) return;
  const fetcher = new OrdersFetcher();
  await fetcher.init();

  let loop = 0;
  while (true) {
    // await matchOrders(limitOrdersContract);
    console.log("activeOrders", fetcher.activeOrders.length);
    // const matches = [];
    for (let i in fetcher.activeOrders) {
      const order0 = fetcher.activeOrders[i];
      for (let j in fetcher.activeOrders) {
        const order1 = fetcher.activeOrders[j];
        if (order0.type === "BUY" && order1.type === "SELL" && order1.price <= order0.price) {
          fetcher.activeOrders[i].status === "Active" &&
            fetcher.activeOrders[j].status === "Active" &&
            limitOrdersContract.functions
              .match_orders(order0.id, order1.id)
              .txParams({ gasPrice: 1 })
              .call()
              .then(() => console.log(`✅ ${order0.id} + ${order1.id}`))
              .catch(console.log);
          await sleep(1);
        }
        if (order1.type === "BUY" && order0.type === "SELL" && order0.price <= order1.price) {
          fetcher.activeOrders[i].status === "Active" &&
            fetcher.activeOrders[j].status === "Active" &&
            limitOrdersContract.functions
              .match_orders(order0.id, order1.id)
              .txParams({ gasPrice: 1 })
              .call()
              .then(() => console.log(`✅ ${order0.id} + ${order1.id}`))
              .catch(console.log);
          await sleep(1);
        }
      }
    }
    await fetcher.sync();
    // console.log("matches", matches.length);
    // const promises = fetcher.activeOrders.reduce(
    //   (acc, order0, _, arr) => [
    //     ...acc,
    //     ...arr.map((order1) =>
    //       limitOrdersContract.functions
    //         .match_orders(order0.id, order1.id)
    //         .call()
    //         .catch(console.log)
    //         .then(() => console.log(`✅ ${order0.id} + ${order1.id}`))
    //     ),
    //   ],
    //   [] as Promise<any>[]
    // );
    // console.log("promises", promises.length);
    // await Promise.all(promises);
    await sleep(120000);
    loop++;
  }
})();
