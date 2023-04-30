import { LimitOrdersAbi } from "../constants/limitOrdersConstants/LimitOrdersAbi";
import { LimitOrdersAbi__factory } from "../constants/limitOrdersConstants/LimitOrdersAbi__factory";
import { Wallet } from "@fuel-ts/wallet";
import { Provider } from "fuels";
import { contractAddress, nodeUrl, privateKey } from "../config";
import BigNumber from "bignumber.js";
import BN from "../utils/BN";
import { IOrder, orderOutputToIOrder } from "../models/Order";

class OrdersFetcher {
  limitOrdersContract: LimitOrdersAbi;
  initialized = false;
  orders: IOrder[] = [];

  constructor() {
    const provider = new Provider(nodeUrl);
    const wallet = Wallet.fromPrivateKey(privateKey, provider);
    this.limitOrdersContract = LimitOrdersAbi__factory.connect(contractAddress, wallet);
  }

  get activeOrders() {
    return this.orders.filter((o) => o.status === "Active");
  }

  private setInitialized = (l: boolean) => (this.initialized = l);
  public init = async () => {
    if (this.initialized) throw new Error("Already initialized");
    if (this.orders.length === 0) await this.fetchAllOrders();
    this.setInitialized(true);
  };

  sync = () => Promise.all([this.fetchNewOrders(), this.updateActiveOrders()]);

  fetchAllOrders = async () => {
    let ordersAmount = await this.getOrdersAmount();
    if (this.limitOrdersContract === null || ordersAmount == null) return;
    let functions = this.limitOrdersContract.functions;
    const length = new BN(ordersAmount.toString())
      .div(10)
      .toDecimalPlaces(0, BigNumber.ROUND_CEIL)
      .toNumber();
    let chunks = await Promise.all(
      Array.from({ length }, (_, i) =>
        functions
          .orders(i * 10)
          .get()
          .then((res) => res.value.filter((v) => v != null).map(orderOutputToIOrder))
      )
    );
    this.orders = chunks.flat();
  };

  fetchNewOrders = async () => {
    let ordersAmount = await this.getOrdersAmount();
    let functions = this.limitOrdersContract?.functions;
    let ordersLength = this.orders.length;
    if (functions == null || ordersAmount == null || ordersLength === 0) return;
    let firstOrderId = this.orders[0].id;
    let length = new BN(ordersAmount.toString())
      .minus(ordersLength)
      .div(10)
      .toDecimalPlaces(0, BigNumber.ROUND_CEIL)
      .toNumber();
    if (length === 0) return;
    let chunks = await Promise.all(
      Array.from({ length }, (_, i) =>
        functions!
          .orders(i * 10)
          .get()
          .then((res) =>
            res.value.filter((v) => v != null && v.id.gt(firstOrderId)).map(orderOutputToIOrder)
          )
      )
    );
    this.orders = [...chunks.flat(), ...this.orders];
  };

  updateActiveOrders = async () => {
    if (this.orders.length === 0) await this.fetchNewOrders();
    let functions = this.limitOrdersContract?.functions;
    if (functions == null) return;
    const activeOrders = this.orders.filter((o) => o.status === "Active");
    const chunks = sliceIntoChunks(activeOrders, 10).map((chunk) =>
      chunk.map((o) => o.id.toString()).concat(Array(10 - chunk.length).fill("0"))
    );
    let res = await Promise.all(
      chunks.map((chunk) =>
        functions
          ?.orders_by_id(chunk as any)
          .get()
          .then((res) => res.value)
      )
    );
    res.flat().forEach((order) => {
      if (order != null) {
        const i = this.orders.findIndex((o) => o.id === order.id.toString());
        this.orders[i] = orderOutputToIOrder(order);
      }
    });
  };

  getOrdersAmount = () =>
    this.limitOrdersContract?.functions
      .orders_amount()
      .get()
      .then((res) => res.value);
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
