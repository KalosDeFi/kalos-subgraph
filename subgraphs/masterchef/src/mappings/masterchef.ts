/* eslint-disable @typescript-eslint/no-unused-vars */
import { log } from "@graphprotocol/graph-ts";
import {
  AddPool,
  Deposit,
  EmergencyWithdraw,
  SetPool,
  UpdatePool,
  Withdraw,
  UpdateKaloRate,
  UpdateBoostMultiplier,
} from "../../generated/MasterChef/MasterChef";
import { getOrCreateMasterChef } from "../entities/master-chef";
import { getOrCreatePool } from "../entities/pool";
import { getOrCreateUser, getBoostMultiplier } from "../entities/user";
import { ACC_KALO_PRECISION, BOOST_PRECISION, BI_ONE, BI_ZERO } from "../utils";

export function handleAddPool(event: AddPool): void {
  log.info("[MasterChef] Add Pool {} {} {} {}", [
    event.params.pid.toString(),
    event.params.allocPoint.toString(),
    event.params.lpToken.toHex(),
    event.params.isRegular ? "true" : "false",
  ]);

  const masterChef = getOrCreateMasterChef(event.block);
  const pool = getOrCreatePool(event.params.pid, event.block);

  pool.pair = event.params.lpToken;
  pool.allocPoint = event.params.allocPoint;
  pool.isRegular = event.params.isRegular;
  pool.save();

  if (event.params.isRegular) {
    masterChef.totalRegularAllocPoint = masterChef.totalRegularAllocPoint.plus(pool.allocPoint);
  } else {
    masterChef.totalSpecialAllocPoint = masterChef.totalSpecialAllocPoint.plus(pool.allocPoint);
  }
  masterChef.poolCount = masterChef.poolCount.plus(BI_ONE);
  masterChef.save();
}

export function handleSetPool(event: SetPool): void {
  log.info("[MasterChef] ˝Set Pool {} {}", [event.params.pid.toString(), event.params.allocPoint.toString()]);

  const masterChef = getOrCreateMasterChef(event.block);
  const pool = getOrCreatePool(event.params.pid, event.block);

  if (pool.isRegular) {
    masterChef.totalRegularAllocPoint = masterChef.totalRegularAllocPoint.plus(
      event.params.allocPoint.minus(pool.allocPoint)
    );
  } else {
    masterChef.totalSpecialAllocPoint = masterChef.totalSpecialAllocPoint.plus(
      event.params.allocPoint.minus(pool.allocPoint)
    );
  }

  masterChef.save();

  pool.allocPoint = event.params.allocPoint;
  pool.save();
}

export function handleUpdatePool(event: UpdatePool): void {
  log.info("[MasterChef] Update Pool {} {} {} {}", [
    event.params.pid.toString(),
    event.params.lastRewardBlock.toString(),
    event.params.lpSupply.toString(),
    event.params.acckaloPerShare.toString(),
  ]);

  const masterChef = getOrCreateMasterChef(event.block);
  const pool = getOrCreatePool(event.params.pid, event.block);

  pool.accKaloPerShare = event.params.accKaloPerShare;
  pool.lastRewardBlock = event.params.lastRewardBlock;
  pool.save();
}

export function handleDeposit(event: Deposit): void {
  log.info("[MasterChef] Log Deposit {} {} {}", [
    event.params.user.toHex(),
    event.params.pid.toString(),
    event.params.amount.toString(),
  ]);

  const masterChef = getOrCreateMasterChef(event.block);
  const pool = getOrCreatePool(event.params.pid, event.block);
  const user = getOrCreateUser(event.params.user, pool, event.block);

  const multiplier = getBoostMultiplier(user);

  pool.slpBalance = pool.slpBalance.plus(event.params.amount);

  user.amount = user.amount.plus(event.params.amount);
  pool.totalBoostedShare = pool.totalBoostedShare.plus(event.params.amount.times(multiplier).div(BOOST_PRECISION));

  user.rewardDebt = user.amount
    .times(multiplier)
    .div(BOOST_PRECISION)
    .times(pool.accKaloPerShare)
    .div(ACC_KALO_PRECISION);

  pool.save();
  user.save();
}

export function handleWithdraw(event: Withdraw): void {
  log.info("[MasterChef] Log Withdraw {} {} {}", [
    event.params.user.toHex(),
    event.params.pid.toString(),
    event.params.amount.toString(),
  ]);

  const masterChef = getOrCreateMasterChef(event.block);
  const pool = getOrCreatePool(event.params.pid, event.block);
  const user = getOrCreateUser(event.params.user, pool, event.block);

  const multiplier = getBoostMultiplier(user);

  pool.slpBalance = pool.slpBalance.minus(event.params.amount);
  user.amount = user.amount.minus(event.params.amount);

  if (user.amount.equals(BI_ZERO)) {
    pool.userCount = pool.userCount.minus(BI_ONE);
  }

  user.rewardDebt = user.amount
    .times(multiplier)
    .div(BOOST_PRECISION)
    .times(pool.accKaloPerShare)
    .div(ACC_KALO_PRECISION);

  pool.save();
  user.save();
}

export function handleEmergencyWithdraw(event: EmergencyWithdraw): void {
  log.info("[MasterChef] Log Emergency Withdraw {} {} {}", [
    event.params.user.toHex(),
    event.params.pid.toString(),
    event.params.amount.toString(),
  ]);

  const masterChef = getOrCreateMasterChef(event.block);
  const pool = getOrCreatePool(event.params.pid, event.block);
  const user = getOrCreateUser(event.params.user, pool, event.block);

  const multiplier = getBoostMultiplier(user);

  const boostedAmount = event.params.amount.times(multiplier).div(BOOST_PRECISION);

  pool.totalBoostedShare = pool.totalBoostedShare.gt(boostedAmount)
    ? pool.totalBoostedShare.minus(boostedAmount)
    : BI_ZERO;

  user.amount = BI_ZERO;
  user.rewardDebt = BI_ZERO;
  pool.userCount = pool.userCount.minus(BI_ONE);
  user.save();
}

export function handleUpdateKaloRate(event: UpdateKaloRate): void {
  log.info("[MasterChef] Update Kalo Rate {} {} {}", [
    event.params.burnRate.toString(),
    event.params.regularFarmRate.toString(),
    event.params.specialFarmRate.toString(),
  ]);

  const masterChef = getOrCreateMasterChef(event.block);

  masterChef.kaloRateToBurn = event.params.burnRate;
  masterChef.kaloRateToRegularFarm = event.params.regularFarmRate;
  masterChef.kaloRateToSpecialFarm = event.params.specialFarmRate;

  masterChef.save();
}

export function handleUpdateBoostMultiplier(event: UpdateBoostMultiplier): void {
  log.info("[MasterChef] Update Boost Multiplier {} {} {} {}", [
    event.params.user.toString(),
    event.params.pid.toString(),
    event.params.oldMultiplier.toString(),
    event.params.newMultiplier.toString(),
  ]);

  const masterChef = getOrCreateMasterChef(event.block);

  const pool = getOrCreatePool(event.params.pid, event.block);
  const user = getOrCreateUser(event.params.user, pool, event.block);

  user.rewardDebt = user.amount
    .times(event.params.newMultiplier)
    .div(BOOST_PRECISION)
    .times(pool.accKaloPerShare)
    .div(ACC_KALO_PRECISION);

  pool.totalBoostedShare = pool.totalBoostedShare
    .minus(user.amount.times(event.params.oldMultiplier).div(BOOST_PRECISION))
    .plus(user.amount.times(event.params.newMultiplier).div(BOOST_PRECISION));

  user.save();
  pool.save();

  masterChef.save();
}
