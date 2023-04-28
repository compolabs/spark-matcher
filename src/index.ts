import mongoose from "mongoose";
import { mongoUrl } from "./config";
import { initMatcher } from "./services/matcherService";
import { sleep } from "fuels";

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
  while (true) {
    // await matchOrders(limitOrdersContract);
    await sleep(10000);
  }
})();
