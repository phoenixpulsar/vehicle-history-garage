import { context, PersistentSet, storage } from "near-sdk-as"
import { Vehicle } from "../../vehicle/assembly/models";
import { VEHICLE_GARAGE_KEY, AccountId, Timestamp, Category } from "../../utils";

@nearBindgen
export class VehicleGarage {
  created_at: Timestamp = context.blockTimestamp;

  constructor(
    public name: string,
  ) { }

  // ----------------------------------------------------------------------------
  // Basic functions
  // ----------------------------------------------------------------------------

  static create(name: string, new_owners: AccountId[]): void {
    assert(name.length > 0, "VehicleGarage name may not be blank")

    // save the vehicle to storage
    this.set(new VehicleGarage(name))

    // capture owners
    for (let i = 0; i < new_owners.length; i++) {
      owners.add(new_owners[i])
    }
  }

  static get(): VehicleGarage {
    return storage.getSome<VehicleGarage>(VEHICLE_GARAGE_KEY)
  }

  static set(vehicle: VehicleGarage): void {
    storage.set(VEHICLE_GARAGE_KEY, vehicle)
  }

  // ----------------------------------------------------------------------------
  // Vehicles
  // ----------------------------------------------------------------------------

  static add_vehicle(accountId: AccountId): void {
    vehicles.add(accountId)
  }

  static remove_vehicle(accountId: AccountId): void {
    vehicles.delete(accountId)
  }

  static has_vehicle(accountId: AccountId): bool {
    return vehicles.has(accountId)
  }

  static get_vehicles_list(): string[] {
    return vehicles.values()
  }

  static get_vehicles_count(): u32 {
    return vehicles.size
  }

  // ----------------------------------------------------------------------------
  // Contributors
  // ----------------------------------------------------------------------------

  static add_contributor(account: AccountId): void {
    contributors.add(account)
  }

  static remove_contributor(account: AccountId): void {
    contributors.delete(account)
  }

  static is_contributor(account: AccountId): bool {
    return contributors.has(account)
  }

  // ----------------------------------------------------------------------------
  // Owners
  // ----------------------------------------------------------------------------

  static add_owner(account: AccountId): void {
    owners.add(account)
  }

  static remove_owner(account: AccountId): void {
    owners.delete(account)
  }

  static has_owner(account: AccountId): bool {
    return owners.has(account)
  }

  static get_owner_list(): AccountId[] {
    return owners.values()
  }
}

const vehicles = new PersistentSet<AccountId>("v")
const contributors = new PersistentSet<AccountId>("c")
const owners = new PersistentSet<AccountId>("o")

@nearBindgen
export class VehicleInitArgs {
  constructor(
    public title: string,
    public data: string,
    public category: Category,
    public owner: AccountId
  ) { }
}

@nearBindgen
export class VehicleNameAsArg {
  constructor(
    public vehicle: string
  ) { }
}
