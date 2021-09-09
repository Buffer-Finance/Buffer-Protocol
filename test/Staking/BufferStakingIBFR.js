const {assert} = require("chai");
const {
  getContracts,
  toWei,
  timeTravel,
  MAX_INTEGER,
} = require("../utils/utils.js");
const BN = web3.utils.BN;
const ACCURACY = 1e30;

contract("BufferStakingIBFR", ([user1, user2, user3]) => {
  const contracts = getContracts();
  async function buy(from = user1, amount = 1) {
    const {StakingIBFR, BNBPool} = await contracts;

    const value = toWei(amount);

    await BNBPool.provide(0, user1, {value, from});

    const balance = await BNBPool.balanceOf(from);

    // Buy
    
    await BNBPool.approve(StakingIBFR.address, balance, {
      from,
    });

    const lotPrice = await StakingIBFR.lotPrice();
    await StakingIBFR.buy(balance.div(lotPrice), {from});
  }

  async function sendProfit(_value, from = user1) {
    const {StakingIBFR, IBFRContract} = await contracts;
    await IBFRContract.transfer(from, _value, {from: user1});

    await IBFRContract.approve(StakingIBFR.address, _value, {
      from,
    });
    const initialBalanceOfOwnner = await IBFRContract.balanceOf(user1);

    await StakingIBFR.sendProfit(_value, {from});

    return initialBalanceOfOwnner;
  }
  it("Should call the constructor and set values", async () => {
    const {StakingIBFR, IBFRContract} = await contracts;
    console.log("Staking ", StakingIBFR.address);
    console.log("IBFR ", IBFRContract.address);

    // Assertions
    assert.equal(
      await StakingIBFR.FALLBACK_RECIPIENT.call(),
      user1,
      "The first account isn't the FALLBACK_RECIPIENT"
    );
  });
  it("Should send the profit to FALLBACK_RECIPIENT(owner) when totalSupply is 0", async () => {
    const {StakingIBFR, IBFRContract} = await contracts;
    const profit = toWei(0.001);

    const initialBalanceOfOwnner = await sendProfit(profit, user2);
    const finalBalanceOfOwnner = await IBFRContract.balanceOf(user1);

    const ownerBalanceDiff = finalBalanceOfOwnner.sub(initialBalanceOfOwnner);
    assert.equal(ownerBalanceDiff, parseInt(profit), "Wrong profit");
  });

  it("Should stake tokens", async () => {
    await buy();
  });

  it("Should send the profit", async () => {
    const {StakingIBFR, IBFRContract} = await contracts;
    const profit = new BN(toWei(0.001));
    const userIBFRRBalanceInitial = await IBFRContract.balanceOf(user2);

    await sendProfit(profit, user2);

    const totalSupply = await StakingIBFR.totalSupply();
    const totalProfit = await StakingIBFR.totalProfit();
    const accuracy = await StakingIBFR.ACCURACY.call();
    const expectedProfit = profit.mul(accuracy).div(totalSupply);

    // console.log(StakingIBFR.address)
    const stakingContractIBFRBalance = await IBFRContract.balanceOf(
      StakingIBFR.address
    );

    const userIBFRRBalanceFinal = await IBFRContract.balanceOf(user2);
    // console.log("userIBFRRBalanceFinal", typeof(userIBFRRBalanceFinal), userIBFRRBalanceFinal.div(new BN(100)));
    assert(totalProfit.eq(expectedProfit), "Wrong profit");
    assert(
      userIBFRRBalanceInitial.eq(userIBFRRBalanceFinal),
      "Wrong user IBFR balance"
    );
    assert(stakingContractIBFRBalance.eq(profit), "Wrong profit");
  });

  it("Should give all the profit to user1", async () => {
    const {StakingIBFR} = await contracts;
    const expectedProfit = toWei(0.001);

    // Before sending profit
    const startProfit = await StakingIBFR.profitOf(user1).then(BN);

    // Send profit(settlement fee)
    await sendProfit(expectedProfit);

    // After sending profit
    const profit = await StakingIBFR.profitOf(user1)
      .then(BN)
      .then(x => x.sub(startProfit))
      .then(x => x.toString());

    // Assertions
    assert.equal(profit, expectedProfit, "Wrong profit");
  });

  it("Should save profit after transfer", async () => {
    const {StakingIBFR} = await contracts;
    const startProfit = await StakingIBFR.profitOf(user1);

    await StakingIBFR.transfer(user2, 1, {from: user1});

    const profit = await StakingIBFR.profitOf(user1);

    assert(profit.eq(startProfit), "Wrong profit");
  });

  it("Should stake for another user and distribute profit", async () => {
    const {IBFRContract, StakingIBFR} = await contracts;
    const summaryProfit = "10000";
    const expectedProfit = [];

    await StakingIBFR.claimProfit({from: user1});

    // User2 stakes iBFR
    await buy(user2, 2);
    await buy(user1, 2);

    const totalProfitInitial = await StakingIBFR.totalProfit.call();

    // Send profit(settlement fee)
    await sendProfit(summaryProfit);

    // After sending profit
    const endProfit = await Promise.all([
      StakingIBFR.profitOf(user1),
      StakingIBFR.profitOf(user2),
    ]);

    // Calculate expected profit
    const sBFRBalance1 = await StakingIBFR.balanceOf.call(user1);
    const sBFRBalance2 = await StakingIBFR.balanceOf.call(user2);

    const totalProfitFinal = await StakingIBFR.totalProfit.call();
    const totalProfitDiff = totalProfitFinal.sub(totalProfitInitial);

    const accuracy = await StakingIBFR.ACCURACY.call();
    expectedProfit[0] = totalProfitDiff.mul(sBFRBalance1).div(accuracy);
    expectedProfit[1] = totalProfitDiff.mul(sBFRBalance2).div(accuracy);

    // Assertions
    endProfit.forEach((x, i) => {
      assert(x.eq(expectedProfit[i]), `User${i}: Wrong profit`);
    });
  });

  it("Should zero profit after claim", async () => {
    const {StakingIBFR, IBFRContract} = await contracts;
    const profit = await StakingIBFR.profitOf(user2).then(x => x.toString());

    const stakingContractIBFRBalanceInitial = await IBFRContract.balanceOf(
      StakingIBFR.address
    );
    const event = await StakingIBFR.claimProfit({from: user2}).then(x =>
      x.logs.find(x => x.event == "Claim")
    );
    const stakingContractIBFRBalanceFinal = await IBFRContract.balanceOf(
      StakingIBFR.address
    );
    const userIBFRBalance = await IBFRContract.balanceOf(user2);

    const stakingContractIBFRBalanceDiff =
      stakingContractIBFRBalanceInitial - stakingContractIBFRBalanceFinal;

    const zeroProfit = await StakingIBFR.profitOf(user2).then(x =>
      x.toString()
    );
    assert.isDefined(event, "Claim event wasn't found");
    assert.equal(event.args.amount.toString(), profit, "wrong claimed profit");
    assert.equal(zeroProfit, "0", "profit is not equal 0");
    assert.equal(
      userIBFRBalance,
      stakingContractIBFRBalanceDiff,
      "IBFR distribution is screwed"
    );
  });

  it("Shouldn't claim twice", async () => {
    const {StakingIBFR} = await contracts;
    await StakingIBFR.claimProfit({from: user2}).then(
      () => assert.fail("A profit was claimed twice"),
      x => assert.equal(x.reason, "Zero profit", "Wrong error reason")
    );
  });
  it("Shouldn't sell while in the lockup period", async () => {
    const {StakingIBFR} = await contracts;
    await StakingIBFR.sell("1").then(
      () => assert.fail("Sold in the lockup period"),
      x =>
        assert.equal(
          x.reason,
          "Action suspended due to lockup",
          "Wrong error reason"
        )
    );
  });
  it("Shouldn't sell tokens if the amount is greater than the balance", async () => {
    const {StakingIBFR} = await contracts;
    await timeTravel(24 * 3600 + 1);

    const userBalance = await StakingIBFR.balanceOf(user2);

    await StakingIBFR.sell(userBalance + 1).then(
      () => assert.fail("Sold more number of tokens than present"),
      x =>
        assert.equal(
          x.reason,
          "ERC20: burn amount exceeds balance",
          "Wrong error reason"
        )
    );
  });

  it("Should sell some tokens", async () => {
    const {StakingIBFR} = await contracts;
    await timeTravel(24 * 3600 + 1);
    const sBFRBalanceInitial = await StakingIBFR.balanceOf.call(user1);

    await StakingIBFR.sell(sBFRBalanceInitial);
    const sBFRBalanceFinal = await StakingIBFR.balanceOf.call(user1);
    assert.equal(sBFRBalanceFinal, 0, "sBFRBalanceFinal: Wrong value");
  });

  it("Shouldn't lose profit after selling", async () => {
    const {StakingIBFR} = await contracts;
    const profit = toWei(0.001);

    await sendProfit(profit);

    const startProfit = await StakingIBFR.profitOf(user2).then(x =>
      x.toString()
    );

    await timeTravel(24 * 3600 + 1);

    await StakingIBFR.balanceOf(user2).then(x =>
      StakingIBFR.sell(x, {from: user2})
    );

    const endProfit = await StakingIBFR.profitOf(user2).then(x => x.toString());

    assert.equal(startProfit, endProfit);
  });

  it("Should claim saved profit after selling", async () => {
    const {StakingIBFR} = await contracts;

    await buy();
    await sendProfit("3000");

    const profit = await StakingIBFR.profitOf(user1).then(x => x.toString());

    await timeTravel(24 * 3600 + 1);
    await StakingIBFR.balanceOf(user1).then(x => StakingIBFR.sell(x));

    const event = await StakingIBFR.claimProfit().then(x =>
      x.logs.find(x => x.event == "Claim")
    );
    assert.isDefined(event, "Claim event wasn't found");
    assert.equal(event.args.amount.toString(), profit, "wrong claimed profit");
  });
});
