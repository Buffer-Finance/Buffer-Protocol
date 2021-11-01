const BN = web3.utils.BN;
const IBFR = artifacts.require("IBFR");

const PriceProvider = artifacts.require("FakePriceProvider");
const BTCPriceProvider = artifacts.require("FakeBTCPriceProvider");

const BNBOptions = artifacts.require("BufferBNBOptions");
const GenericBNBOptions = artifacts.require("BufferGenericBNBOptions");

const BNBPool = artifacts.require("BufferBNBPool");
const StakingBNB = artifacts.require("BufferStakingBNB");
const StakingiBFR = artifacts.require("BufferStakingIBFR");

const params = {
  BNBPrice: new BN(380e8),
  BTCPrice: new BN(6e12),
  BNBtoBTC() {
    return this.BNBPrice.mul(new BN("10000000000000000000000000000000")).div(
      this.BTCPrice
    );
  },
  ExchangePrice: new BN(30e8),
};

module.exports = async function (deployer, network, [account]) {
  const chainlinkTestnet = "0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526";
  const chainlinkBTCTestnet = "0x5741306c21795FdCBb9b265Ea0255F499DFe515C";

  if (network === "development") {
    await deployer.deploy(IBFR);
    await IBFR.deployed();

    await deployer.deploy(BNBPool);
    const BNBPoolInstance = await BNBPool.deployed();

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

    const OPTION_ISSUER_ROLE = await BNBPoolInstance.OPTION_ISSUER_ROLE.call();
    await BNBPoolInstance.grantRole(OPTION_ISSUER_ROLE, BNBOptions.address, {from: account});

    await deployer.deploy(BTCPriceProvider, params.BTCPrice);
    await BTCPriceProvider.deployed();

    await deployer.deploy(
      GenericBNBOptions,
      BTCPriceProvider.address,
      PriceProvider.address,
      // chainlinkBTCTestnet,
      // chainlinkTestnet,
      StakingBNB.address,
      BNBPool.address
    );

    // const OPTION_ISSUER_ROLE = await BNBPoolInstance.OPTION_ISSUER_ROLE.call();
    await BNBPoolInstance.grantRole(OPTION_ISSUER_ROLE, GenericBNBOptions.address, {from: account});

  } else {
    await deployer.deploy(IBFR);
    await IBFR.deployed();

    await deployer.deploy(BNBPool);
    const BNBPoolInstance = await BNBPool.deployed();

    await deployer.deploy(StakingBNB, IBFR.address);
    await deployer.deploy(StakingiBFR, IBFR.address, BNBPool.address);

    await deployer.deploy(
      BNBOptions,
      chainlinkTestnet,
      StakingBNB.address,
      BNBPool.address
    );

    const OPTION_ISSUER_ROLE = await BNBPoolInstance.OPTION_ISSUER_ROLE.call();
    await BNBPoolInstance.grantRole(OPTION_ISSUER_ROLE, BNBOptions.address, {from: account});


    await deployer.deploy(
      GenericBNBOptions,
      chainlinkBTCTestnet,
      chainlinkTestnet,
      StakingBNB.address,
      BNBPool.address
    );

    // const OPTION_ISSUER_ROLE = await BNBPoolInstance.OPTION_ISSUER_ROLE.call();
    await BNBPoolInstance.grantRole(OPTION_ISSUER_ROLE, GenericBNBOptions.address, {from: account});


  }
};
