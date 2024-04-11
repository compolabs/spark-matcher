/* Autogenerated file. Do not edit manually. */

/* tslint:disable */
/* eslint-disable */

/*
  Fuels version: 0.77.0
  Forc version: 0.51.1
  Fuel-Core version: 0.22.1
*/

import type {
  BigNumberish,
  BN,
  Bytes,
  BytesLike,
  Contract,
  DecodedValue,
  FunctionFragment,
  Interface,
  InvokeFunction,
} from 'fuels';

import type { Option, Enum, Vec } from "./common";

export enum ErrorInput { AccessDenied = 'AccessDenied', InvalidPythFeePayment = 'InvalidPythFeePayment', DebugModeRequired = 'DebugModeRequired' };
export enum ErrorOutput { AccessDenied = 'AccessDenied', InvalidPythFeePayment = 'InvalidPythFeePayment', DebugModeRequired = 'DebugModeRequired' };

export type AddressInput = { value: string };
export type AddressOutput = AddressInput;
export type RawBytesInput = { ptr: BigNumberish, cap: BigNumberish };
export type RawBytesOutput = { ptr: BN, cap: BN };
export type SparkContractsInput = { version: BigNumberish, account_balance_address: AddressInput, clearing_house_address: AddressInput, insurance_fund_address: AddressInput, treasury_address: AddressInput, perp_market_address: AddressInput, vault_address: AddressInput, pyth_address: AddressInput };
export type SparkContractsOutput = { version: BN, account_balance_address: AddressOutput, clearing_house_address: AddressOutput, insurance_fund_address: AddressOutput, treasury_address: AddressOutput, perp_market_address: AddressOutput, vault_address: AddressOutput, pyth_address: AddressOutput };

export type ProxyAbiConfigurables = {
  OWNER: AddressInput;
  DEBUG_STEP: Option;
};

interface ProxyAbiInterface extends Interface {
  functions: {
    debug_increment_timestamp: FunctionFragment;
    debug_set_price: FunctionFragment;
    get_all_spark_contracts_versions: FunctionFragment;
    get_price: FunctionFragment;
    get_spark_contracts: FunctionFragment;
    get_spark_contracts_by_version: FunctionFragment;
    publish_new_version: FunctionFragment;
    timestamp: FunctionFragment;
    update_price: FunctionFragment;
    version: FunctionFragment;
  };

  encodeFunctionData(functionFragment: 'debug_increment_timestamp', values: []): Uint8Array;
  encodeFunctionData(functionFragment: 'debug_set_price', values: [string, BigNumberish]): Uint8Array;
  encodeFunctionData(functionFragment: 'get_all_spark_contracts_versions', values: []): Uint8Array;
  encodeFunctionData(functionFragment: 'get_price', values: [string]): Uint8Array;
  encodeFunctionData(functionFragment: 'get_spark_contracts', values: []): Uint8Array;
  encodeFunctionData(functionFragment: 'get_spark_contracts_by_version', values: [BigNumberish]): Uint8Array;
  encodeFunctionData(functionFragment: 'publish_new_version', values: [AddressInput, AddressInput, AddressInput, AddressInput, AddressInput, AddressInput, AddressInput]): Uint8Array;
  encodeFunctionData(functionFragment: 'timestamp', values: []): Uint8Array;
  encodeFunctionData(functionFragment: 'update_price', values: [Vec<Bytes>]): Uint8Array;
  encodeFunctionData(functionFragment: 'version', values: []): Uint8Array;

  decodeFunctionData(functionFragment: 'debug_increment_timestamp', data: BytesLike): DecodedValue;
  decodeFunctionData(functionFragment: 'debug_set_price', data: BytesLike): DecodedValue;
  decodeFunctionData(functionFragment: 'get_all_spark_contracts_versions', data: BytesLike): DecodedValue;
  decodeFunctionData(functionFragment: 'get_price', data: BytesLike): DecodedValue;
  decodeFunctionData(functionFragment: 'get_spark_contracts', data: BytesLike): DecodedValue;
  decodeFunctionData(functionFragment: 'get_spark_contracts_by_version', data: BytesLike): DecodedValue;
  decodeFunctionData(functionFragment: 'publish_new_version', data: BytesLike): DecodedValue;
  decodeFunctionData(functionFragment: 'timestamp', data: BytesLike): DecodedValue;
  decodeFunctionData(functionFragment: 'update_price', data: BytesLike): DecodedValue;
  decodeFunctionData(functionFragment: 'version', data: BytesLike): DecodedValue;
}

export class ProxyAbi extends Contract {
  interface: ProxyAbiInterface;
  functions: {
    debug_increment_timestamp: InvokeFunction<[], void>;
    debug_set_price: InvokeFunction<[price_feed: string, price: BigNumberish], void>;
    get_all_spark_contracts_versions: InvokeFunction<[], Vec<SparkContractsOutput>>;
    get_price: InvokeFunction<[price_feed: string], BN>;
    get_spark_contracts: InvokeFunction<[], SparkContractsOutput>;
    get_spark_contracts_by_version: InvokeFunction<[version: BigNumberish], SparkContractsOutput>;
    publish_new_version: InvokeFunction<[account_balance_address: AddressInput, clearing_house_address: AddressInput, insurance_fund_address: AddressInput, treasury_address: AddressInput, perp_market_address: AddressInput, vault_address: AddressInput, pyth_address: AddressInput], void>;
    timestamp: InvokeFunction<[], BN>;
    update_price: InvokeFunction<[price_update_data: Vec<Bytes>], void>;
    version: InvokeFunction<[], BN>;
  };
}
