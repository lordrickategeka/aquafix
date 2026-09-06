import User from "./User";
import Role from "./Role";
import Permission from "./Permission";
import Zone from "./Zone";
import Tariff from "./Tariff";
import TariffSchedule from "./TariffSchedule";
import TariffBand from "./TariffBand";
import Consumer from "./Consumer";
import BillingCycle from "./BillingCycle";
import Reading from "./Reading";
import Bill from "./Bill";
import BillLine from "./BillLine";
import Payment from "./Payment";
import LedgerEntry from "./LedgerEntry";

// User <-> Role (many-to-many via user_roles)
User.belongsToMany(Role, {
  through: "user_roles",
  foreignKey: "user_id",
  otherKey: "role_id",
  as: "roles",
  timestamps: false,
});
Role.belongsToMany(User, {
  through: "user_roles",
  foreignKey: "role_id",
  otherKey: "user_id",
  as: "users",
  timestamps: false,
});

// Role <-> Permission (many-to-many via role_permissions)
Role.belongsToMany(Permission, {
  through: "role_permissions",
  foreignKey: "role_id",
  otherKey: "permission_id",
  as: "permissions",
  timestamps: false,
});
Permission.belongsToMany(Role, {
  through: "role_permissions",
  foreignKey: "permission_id",
  otherKey: "role_id",
  as: "roles",
  timestamps: false,
});

// Schedule -> the categories priced in it, and the cycles that use it
TariffSchedule.hasMany(Tariff, { foreignKey: "schedule_id", as: "tariffs" });
Tariff.belongsTo(TariffSchedule, { foreignKey: "schedule_id", as: "schedule" });
BillingCycle.belongsTo(TariffSchedule, { foreignKey: "tariff_schedule_id", as: "tariffSchedule" });
TariffSchedule.hasMany(BillingCycle, { foreignKey: "tariff_schedule_id", as: "cycles" });

// Tariff -> bands (the progressive slabs for a category revision)
Tariff.hasMany(TariffBand, { foreignKey: "tariff_id", as: "bands" });
TariffBand.belongsTo(Tariff, { foreignKey: "tariff_id", as: "tariff" });

// Zone -> consumers
Zone.hasMany(Consumer, { foreignKey: "zone_id", as: "consumers" });
Consumer.belongsTo(Zone, { foreignKey: "zone_id", as: "zone" });

// Readings sit on the (consumer, cycle) pair
Consumer.hasMany(Reading, { foreignKey: "consumer_id", as: "readings" });
Reading.belongsTo(Consumer, { foreignKey: "consumer_id", as: "consumer" });
BillingCycle.hasMany(Reading, { foreignKey: "billing_cycle_id", as: "readings" });
Reading.belongsTo(BillingCycle, { foreignKey: "billing_cycle_id", as: "cycle" });
Reading.belongsTo(User, { foreignKey: "read_by", as: "reader" });

// Bills
Consumer.hasMany(Bill, { foreignKey: "consumer_id", as: "bills" });
Bill.belongsTo(Consumer, { foreignKey: "consumer_id", as: "consumer" });
BillingCycle.hasMany(Bill, { foreignKey: "billing_cycle_id", as: "bills" });
Bill.belongsTo(BillingCycle, { foreignKey: "billing_cycle_id", as: "cycle" });
Bill.belongsTo(Reading, { foreignKey: "reading_id", as: "reading" });
Bill.hasMany(BillLine, { foreignKey: "bill_id", as: "lines" });
BillLine.belongsTo(Bill, { foreignKey: "bill_id", as: "bill" });

// Payments
Consumer.hasMany(Payment, { foreignKey: "consumer_id", as: "payments" });
Payment.belongsTo(Consumer, { foreignKey: "consumer_id", as: "consumer" });
Payment.belongsTo(User, { foreignKey: "recorded_by", as: "cashier" });

// Ledger — the running record behind consumers.balance
Consumer.hasMany(LedgerEntry, { foreignKey: "consumer_id", as: "ledger" });
LedgerEntry.belongsTo(Consumer, { foreignKey: "consumer_id", as: "consumer" });
LedgerEntry.belongsTo(Bill, { foreignKey: "bill_id", as: "bill" });
LedgerEntry.belongsTo(Payment, { foreignKey: "payment_id", as: "payment" });

export {
  User,
  Role,
  Permission,
  Zone,
  Tariff,
  TariffSchedule,
  TariffBand,
  Consumer,
  BillingCycle,
  Reading,
  Bill,
  BillLine,
  Payment,
  LedgerEntry,
};
