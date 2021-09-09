const BN = web3.utils.BN;
const IBFR = artifacts.require("IBFR");

const PriceProvider = artifacts.require("FakePriceProvider");
const BNBOptions = artifacts.require("BufferBNBOptions");
const BNBPool = artifacts.require("BufferBNBPool");
const StakingBNB = artifacts.require("BufferStakingBNB");
const StakingiBFR = artifacts.require("BufferStakingIBFR");

const params = {
  BNBPrice: new BN(380e8),
  BTCPrice: new BN("1161000000000"),
  BNBtoBTC() {
    return this.BNBPrice.mul(new BN("10000000000000000000000000000000")).div(
      this.BTCPrice
    );
  },
  ExchangePrice: new BN(30e8),
};

module.exports = async function (deployer, network, [account]) {
  const iBFRAddress = "0x27dBeD23A655C01f4A7A46b07bE9239293985fd3";
  const chainlinkTestnet = "0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526";

  if (network === "development") {
    await deployer.deploy(IBFR);
    await IBFR.deployed();

    await deployer.deploy(BNBPool);
    await BNBPool.deployed();

    await deployer.deploy(PriceProvider, params.BNBPrice);
    await PriceProvider.deployed();

    await deployer.deploy(StakingBNB, IBFR.address);
    await deployer.deploy(StakingiBFR, IBFR.address, BNBPool.address);

    await deployer.deploy(
      BNBOptions,
      PriceProvider.address,
      StakingBNB.address,
      BNBPool.address
    );
  } else {
    await deployer.deploy(BNBPool);
    await BNBPool.deployed();

    await deployer.deploy(StakingBNB, iBFRAddress);
    await deployer.deploy(StakingiBFR, iBFRAddress, BNBPool.address);

    await deployer.deploy(
      BNBOptions,
      chainlinkTestnet,
      StakingBNB.address,
      BNBPool.address
    );
  }
};
