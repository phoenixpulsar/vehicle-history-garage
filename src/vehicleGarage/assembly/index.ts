import { ContractPromiseBatch, context, base58, u128, env, storage, logging, ContractPromise } from "near-sdk-as"
import { MIN_ACCOUNT_BALANCE, AccountId, Category, VEHICLE_KEY, XCC_GAS } from "../../utils";
import { VehicleGarage, VehicleInitArgs, VehicleNameAsArg } from "./models";

// import vehicle contract bytecode as StaticArray
const CODE = includeBytes("../../../build/release/vehicle.wasm")

export function init(name: string, owners: AccountId[]): void {
  // contract may only be initialized once
  assert(!is_initialized(), "Contract is already initialized.");

  // storing vehicle metadata requires some storage staking (balance locked to offset cost of data storage)
  assert(
    u128.ge(context.attachedDeposit, MIN_ACCOUNT_BALANCE),
    "Minimum account balance must be attached to initialize this contract (3 NEAR)"
  );

  // Must have least 1 owner account
  assert(owners.length > 0, "Must specify at least 1 owner");

  // create the vehicleGarage using incoming metadata
  VehicleGarage.create(name, owners)

  logging.log("VehicleGarage was created")
}

export function get_vehicle_garage(): VehicleGarage {
  assert_contract_is_initialized()
  return VehicleGarage.get()
}

export function get_owner_list(): AccountId[] {
  assert_contract_is_initialized()
  return VehicleGarage.get_owner_list()
}

export function get_vehicle_list(): AccountId[] {
  assert_contract_is_initialized()
  return VehicleGarage.get_vehicles_list()
}

export function get_vehicle_count(): u32 {
  assert_contract_is_initialized()
  return VehicleGarage.get_vehicles_count()
}

/**
 * Manage your status as a contributor
 */
export function add_myself_as_contributor(): void {
  assert_contract_is_initialized()
  VehicleGarage.add_contributor(context.predecessor)
}

export function remove_myself_as_contributor(): void {
  assert_contract_is_initialized()
  VehicleGarage.remove_contributor(context.predecessor)
}

/**
 * Add your vehicle
 */
export function add_vehicle(
  vehicle: AccountId,
  title: string,
  data: string,
  category: Category,
  owner: AccountId
): void {
  assert_contract_is_initialized()
  assert_signed_by_contributor_or_owner()

  // storing vehicle metadata requires some storage staking (balance locked to offset cost of data storage)
  assert(
    u128.ge(context.attachedDeposit, MIN_ACCOUNT_BALANCE),
    "Minimum account balance must be attached to initialize a vehicle (3 NEAR)"
  );

  const accountId = full_account_for(vehicle)

  assert(env.isValidAccountID(accountId), "Vehicle name must be valid NEAR account name")
  assert(!VehicleGarage.has_vehicle(accountId), "Vehicle name already exists")

  logging.log("attempting to create vehicle")

  let promise = ContractPromiseBatch.create(accountId)
    .create_account()
    .deploy_contract(Uint8Array.wrap(changetype<ArrayBuffer>(CODE)))
    .add_full_access_key(base58.decode(context.senderPublicKey))

  promise.function_call(
    "init",
    new VehicleInitArgs(title, data, category, owner),
    context.attachedDeposit,
    XCC_GAS
  )

  promise.then(context.contractName).function_call(
    "on_vehicle_created",
    new VehicleNameAsArg(vehicle),
    u128.Zero,
    XCC_GAS
  )
}

export function on_vehicle_created(vehicle: AccountId): void {
  let results = ContractPromise.getResults();
  let vehicleCreated = results[0];

  // Verifying the remote contract call succeeded.
  // https://nomicon.io/RuntimeSpec/Components/BindingsSpec/PromisesAPI.html?highlight=promise#returns-3
  switch (vehicleCreated.status) {
    case 0:
      // promise result is not complete
      logging.log("Vehicle creation for [ " + full_account_for(vehicle) + " ] is pending")
      break;
    case 1:
      // promise result is complete and successful
      logging.log("Vehicle creation for [ " + full_account_for(vehicle) + " ] succeeded")
      VehicleGarage.add_vehicle(vehicle)
      break;
    case 2:
      // promise result is complete and failed
      logging.log("Vehicle creation for [ " + full_account_for(vehicle) + " ] failed")
      break;

    default:
      logging.log("Unexpected value for promise result [" + vehicleCreated.status.toString() + "]");
      break;
  }
}

/*
 * Governance methods reserved for 101Labs and NEAR admins
 */
export function add_contributor(account: AccountId): void {
  assert_contract_is_initialized()
  assert_signed_by_owner()

  VehicleGarage.add_contributor(account)

  logging.log("contributor was added")
}

export function remove_contributor(account: AccountId): void {
  assert_contract_is_initialized()
  assert_signed_by_owner()

  VehicleGarage.remove_contributor(account)
}

export function add_owner(account: AccountId): void {
  assert_contract_is_initialized()
  assert_signed_by_owner()

  VehicleGarage.add_owner(account)
}

export function remove_owner(account: AccountId): void {
  assert_contract_is_initialized()
  assert_signed_by_owner()

  VehicleGarage.remove_owner(account)
}

export function remove_vehicle(vehicle: AccountId): void {
  assert_contract_is_initialized()
  assert_signed_by_owner()

  ContractPromiseBatch.create(full_account_for(vehicle))
    .delete_account(context.contractName)
    .then(context.contractName)
    .function_call(
      "on_vehicle_removed",
      new VehicleNameAsArg(vehicle),
      u128.Zero,
      XCC_GAS
    )
}

export function on_vehicle_removed(vehicle: AccountId): void {
  // TODO: confirm that promise was successful
  logging.log("[ " + full_account_for(vehicle) + " ] was removed")
  VehicleGarage.remove_vehicle(vehicle)
}


/**
 * == PRIVATE FUNCTIONS ========================================================
 *
 * Helper functions that are not part of the contract interface
 */

/**
 * Track whether or not the vehicle has been initialized.
 */

function is_initialized(): bool {
  return storage.hasKey(VEHICLE_KEY);
}

function assert_contract_is_initialized(): void {
  assert(is_initialized(), "Contract must be initialized first.");
}


/**
 * Indicate whether contract caller is the creator
 */
function is_owner(): bool {
  return VehicleGarage.has_owner(context.predecessor)
}

function is_contributor(): bool {
  return VehicleGarage.is_contributor(context.predecessor)
}

function assert_signed_by_owner(): void {
  assert(is_owner(), "This method can only be called by a VehicleGarage owner")
}

function assert_signed_by_contributor_or_owner(): void {
  assert(is_contributor() || is_owner(), "This method can only be called by a VehicleGarage contributor or owner")
}

function full_account_for(vehicle: string): string {
  return vehicle + "." + context.contractName
}

function remaining_gas(): u64 {
  return env.prepaid_gas() - (2 * env.used_gas())
}
