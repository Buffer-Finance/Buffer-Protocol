const {time} = require("@openzeppelin/test-helpers");
const PriceContract = artifacts.require("FakePriceProvider");
const BNBOptionsContract = artifacts.require("BufferBNBOptions");
const BNBPoolContract = artifacts.require("BufferBNBPool");
const IBFR = artifacts.require("IBFR");
const BufferStakingBNBContract = artifacts.require("BufferStakingBNB");
const BufferStakingIBFRContract = artifacts.require("BufferStakingIBFR");

const BN = web3.utils.BN;

const send = (method, params = []) =>
  new Promise((resolve, reject) =>
    web3.currentProvider.send(
      {id: 0, jsonrpc: "2.0", method, params},
      (err, x) => {
        if (err) reject(err);
        else resolve(x);
      }
    )
  );

const getContracts = async () => {
  const [
    PriceProvider,
    BNBOptions,
    BNBPool,
    IBFRContract,
    StakingBNB,
    StakingIBFR,
  ] = await Promise.all([
    PriceContract.deployed(),
    BNBOptionsContract.deployed(),
    BNBPoolContract.deployed(),
    IBFR.deployed(),
    BufferStakingBNBContract.deployed(),
    BufferStakingIBFRContract.deployed(),
  ]);
  return {
    PriceProvider,
    BNBOptions,
    BNBPool,
    IBFRContract,
    StakingBNB,
    StakingIBFR,
  };
};

const timeTravel = async seconds => {
  await send("evm_increaseTime", [seconds]);
  await send("evm_mine");
};

const snapshot = () => send("evm_snapshot").then(x => x.result);
const revert = snap => send("evm_revert", [snap]);

module.exports = {
  getContracts,
  timeTravel,
  snapshot,
  revert,
  toWei: value => web3.utils.toWei(value.toString(), "ether"),
  MAX_INTEGER: new BN(2).pow(new BN(256)).sub(new BN(1)),
  OptionType: {Put: 1, Call: 2},
};
