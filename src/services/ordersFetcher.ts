import { LimitOrdersAbi } from "../constants/limitOrdersConstants/LimitOrdersAbi";
import { LimitOrdersAbi__factory } from "../constants/limitOrdersConstants/LimitOrdersAbi__factory";
import { Wallet } from "@fuel-ts/wallet";
import { Provider } from "fuels";
import { Order, orderOutputToIOrder } from "../models/Order";
import { contractAddress, nodeUrl, privateKey } from "../config";
import BigNumber from "bignumber.js";
import BN from "../utils/BN";

class OrdersFetcher {
  limitOrdersContract: LimitOrdersAbi;
  initialized: boolean = false;

  constructor() {
    const provider = new Provider(nodeUrl);
    const wallet = Wallet.fromPrivateKey(privateKey, provider);
    this.limitOrdersContract = LimitOrdersAbi__factory.connect(contractAddress, wallet);
  }

  private setInitialized = (l: boolean) => (this.initialized = l);
  public init = async () => {
    if (this.initialized) throw new Error("Already initialized");
    if ((await this.getLastOrderFromDb()) == null) await this.fetchAllOrders();
    this.setInitialized(true);
  };

  public fetchNewOrders = async () => {
    const totalOrdersAmount = await this.getOrdersAmount().then((v) => v.toNumber());
    const functions = this.limitOrdersContract.functions;
    const lastOrderId = await this.getLastOrderFromDb().then((o) => o.id);
    if (lastOrderId === totalOrdersAmount) return;
    if (lastOrderId > totalOrdersAmount) {
      await Order.deleteMany().then(this.fetchAllOrders);
      return;
    }

    const length = new BN(totalOrdersAmount.toString())
      .minus(lastOrderId)
      .div(10)
      .toDecimalPlaces(0, BigNumber.ROUND_CEIL)
      .toNumber();
    if (length === 0) return;
    const chunks = await Promise.all(
      Array.from({ length }, (_, i) =>
        functions!
          .orders(i * 10)
          .get()
          .then((res) => res.value.filter((v) => v != null && v.id.gt(lastOrderId)))
          .then((res) => res.map(orderOutputToIOrder))
      )
    );
    await Order.insertMany(chunks.flat().reverse());
  };

  public updateActiveOrders = async () => {
    const functions = this.limitOrdersContract.functions;
    const activeOrders = await Order.find({ status: "Active" });
    const chunks = sliceIntoChunks(activeOrders, 10).map((chunk) =>
      chunk.map((o) => o.id.toString()).concat(Array(10 - chunk.length).fill("0"))
    );
    const res = await Promise.all(
      chunks.map((chunk) =>
        functions
          .orders_by_id(chunk as any)
          .get()
          .then((res) => res.value)
      )
    );
    await Promise.all(
      res.flat().map((orderOutput) => {
        if (orderOutput != null) {
          const order = orderOutputToIOrder(orderOutput);
          return Order.updateOne({ id: order.id }, order);
        }
      })
    );
  };

  private fetchAllOrders = async () => {
    const ordersAmount = await this.getOrdersAmount();
    if (this.limitOrdersContract === null || ordersAmount == null) return;
    const functions = this.limitOrdersContract.functions;
    const length = new BN(ordersAmount.toString())
      .div(10)
      .toDecimalPlaces(0, BigNumber.ROUND_CEIL)
      .toNumber();
    const chunks = await Promise.all(
      Array.from({ length }, (_, i) =>
        functions
          .orders(i * 10)
          .get()
          .then((res) => res.value.filter((v) => v != null))
      )
    );

    await Order.insertMany(chunks.flat().map(orderOutputToIOrder).flat().reverse());
  };

  private getOrdersAmount = () =>
    this.limitOrdersContract.functions
      .orders_amount()
      .simulate()
      .then((res) => res.value)
      .catch((e) => {
        throw new Error(`❌ Cannot get orders amount\n ${e}`);
      });

  private getLastOrderFromDb = () =>
    Order.find()
      .sort({ id: -1 })
      .limit(1)
      .then((arr) => arr[0]);
}

function sliceIntoChunks<T>(arr: T[], chunkSize: number): T[][] {
  const res = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    const chunk = arr.slice(i, i + chunkSize);
    res.push(chunk);
  }
  return res;
}

export default OrdersFetcher;
