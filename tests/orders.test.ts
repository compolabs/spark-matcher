import { initMongo } from "../src/services/mongoService";
import { Order } from "../src/models/Order";

describe("items", () => {
  beforeAll(() => initMongo());

  it("test", async () => {
    // console.log(await Order.count());
    // console.log(await Order.count());
    //activeOrders[i].status === "Active" &&
    //             activeOrders[j].status === "Active"
    console.log(
      await Order.findOne({ id: 1 })
        .select({ _id: false, status: true })
        .then((order) => order?.status === "Active")
    );
  });
  it("print db", async () => {
    const orders = await Order.find({});
    // console.dir(orders, { maxArrayLength: null });
    console.dir(
      orders.filter((o) => o.id > 100).map((o) => o.id),
      { maxArrayLength: null }
    );
  }, 500000);
  it("drop db", async () => {
    // await Order.deleteMany();
  }, 500000);
});
