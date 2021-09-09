const {assert} = require("chai");

const {
  getContracts,
  toWei,
  timeTravel,
  MAX_INTEGER,
} = require("../utils/utils.js");

const BN = web3.utils.BN;
const ACCURACY = 1e30;
const toBN = web3.utils.toBN;

contract("BufferStakingBNB", ([user1, user2, user3]) => {
  const contracts = getContracts();
  async function buy(amount = 1, from = user1) {
    const { IBFRContract, StakingBNB } = await contracts;

    // Buy
    const iBFRtoPay = (await StakingBNB.lotPrice()).mul(new BN(amount)); 
    await IBFRContract.approve(StakingBNB.address, iBFRtoPay, {
      from,
    });
    await StakingBNB.buy(amount, { from });

  }

  async function sendProfit(_value, from = user1) {
    const { StakingBNB } = await contracts;
    const value = toBN(_value);
    await StakingBNB.sendProfit({ from, value });
  }
  it("Should call the constructor and set values", async () => {
    const { StakingBNB, IBFRContract } = await contracts;
    console.log("Staking ", StakingBNB.address);
    console.log("IBFR ", IBFRContract.address);

    // Assertions
    assert.equal(
      await StakingBNB.FALLBACK_RECIPIENT.call(),
      user1,
      "The first account isn't the FALLBACK_RECIPIENT"
    );
    assert.equal(
      await StakingBNB.BUFFER.call(),
      IBFRContract.address,
      "Token not set correctly"
    );
  });
  it("Should send the profit to FALLBACK_RECIPIENT(owner) when totalSupply is 0", async () => {
    const { StakingBNB } = await contracts;
    const profit = "10000";

    const initialBalanceOfOwnner = await web3.eth
      .getBalance(user1)
      .then(BigInt);

    await sendProfit(profit, user2);

    const finalBalanceOfOwnner = await web3.eth.getBalance(user1).then(BigInt);

    const ownerBalanceDiff = finalBalanceOfOwnner - initialBalanceOfOwnner;

    assert.equal(ownerBalanceDiff, parseInt(profit), "Wrong profit");
  });
  it("Should stake tokens", async () => {
    await buy();
  });
  it("Should send the profit", async () => {
    const { StakingBNB } = await contracts;
    const profit = "1000";

    await sendProfit(profit);

    const totalSupply = await StakingBNB.totalSupply.call();
    const totalProfit = await StakingBNB.totalProfit.call();

    const accuracy = await StakingBNB.ACCURACY.call();

    const expectedProfit = toBN(profit).mul(accuracy).div(totalSupply);

    assert(totalProfit.eq(expectedProfit), "Wrong profit");
  });
  it("Should give all the profit to user1", async () => {
    const { StakingBNB } = await contracts;
    const expectedProfit = "1000";

    // Before sending profit
    const startProfit = await StakingBNB.profitOf(user1).then(toBN);

    // Send profit(settlement fee)
    await sendProfit(expectedProfit);

    // After sending profit
    const profit = await StakingBNB.profitOf(user1)
      .then(toBN)
      .then(x => x.sub(startProfit))
      .then(x => x.toString());

    // Assertions
    assert.equal(profit, expectedProfit, "Wrong profit");
  });

  it("Should save profit after transfer", async () => {
    const { StakingBNB } = await contracts;
    const startProfit = await StakingBNB.profitOf(user1)

    await StakingBNB.transfer(user2, 1, { from: user1 });

    const profit = await StakingBNB.profitOf(user1);

    assert(profit.eq(startProfit), "Wrong profit");
  });

  it("Should stake for another user and distribute profit", async () => {
    const { IBFRContract, StakingBNB } = await contracts;
    const summaryProfit = "10000";
    const expectedProfit = [];

    // Give some iBFRs to user2
    const transferAmount = toBN(toWei(5000));
    await IBFRContract.transfer(user2, transferAmount, {
      from: user1,
    });

    // User2 stakes iBFR
    const lotPrice = await StakingBNB.lotPrice();
    await buy(transferAmount.div(lotPrice), user2);

    // Before sending profit
    const startProfit = await Promise.all([
      StakingBNB.profitOf(user1),
      StakingBNB.profitOf(user2),
    ]);
    const totalProfitInitial = await StakingBNB.totalProfit.call()

    // Send profit(settlement fee)
    await sendProfit(summaryProfit);

    // After sending profit
    const profit = await Promise.all([
      StakingBNB.profitOf(user1),
      StakingBNB.profitOf(user2),
    ]).then(x => x.map((x, i) => x.sub(startProfit[i])));

    // Calculate expected profit
    const sBFRBalance1 = await StakingBNB.balanceOf.call(user1);
    const sBFRBalance2 = await StakingBNB.balanceOf.call(user2);

    const totalProfitFinal = await StakingBNB.totalProfit.call();
    const totalProfitDiff = totalProfitFinal.sub(totalProfitInitial);

    const accuracy = await StakingBNB.ACCURACY.call();

    expectedProfit[0] = totalProfitDiff.mul(sBFRBalance1).div(accuracy);
    expectedProfit[1] = totalProfitDiff.mul(sBFRBalance2).div(accuracy);

    // Assertions
    profit.forEach((x, i) => {
      assert(x.eq(expectedProfit[i]), `User${i}: Wrong profit`);
    });
  });

  it("Should zero profit after claim", async () => {
    const { StakingBNB } = await contracts;
    const profit = await StakingBNB.profitOf(user1).then(x => x.toString());
    const event = await StakingBNB.claimProfit().then(x =>
      x.logs.find(x => x.event == "Claim")
    );
    assert.isDefined(event, "Claim event wasn't found");
    assert.equal(event.args.amount.toString(), profit, "wrong claimed profit");
    const zeroProfit = await StakingBNB.profitOf(user1).then(x => x.toString());
    assert.equal(zeroProfit, "0", "profit is not equal 0");
  });

  it("Shouldn't claim twice", async () => {
    const { StakingBNB } = await contracts;
    await StakingBNB.claimProfit().then(
      () => assert.fail("A profit was claimed twice"),
      x => assert.equal(x.reason, "Zero profit", "Wrong error reason")
    );
  });
  it("Shouldn't sell while in the lockup period", async () => {
    const { StakingBNB } = await contracts;
    await StakingBNB.sell("1").then(
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
    const { StakingBNB } = await contracts;
    await timeTravel(24 * 3600 + 1);

    await StakingBNB.sell(toWei(1)).then(
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
    const { StakingBNB } = await contracts;
    await timeTravel(24 * 3600 + 1);
    const sBFRBalanceInitial = await StakingBNB.balanceOf
      .call(user1)
      .then(parseInt);

    await StakingBNB.sell(sBFRBalanceInitial);
    const sBFRBalanceFinal = await StakingBNB.balanceOf
      .call(user1)
      .then(parseInt);
    assert.equal(sBFRBalanceFinal, 0, "sBFRBalanceFinal: Wrong value");
  });

  it("Shouldn't lose profit after selling", async () => {
    const { StakingBNB } = await contracts;

    await sendProfit("3000");

    const startProfit = await StakingBNB.profitOf(user2);

    await timeTravel(24 * 3600 + 1);

    await StakingBNB.balanceOf(user2).then(x =>
      StakingBNB.sell(x, { from: user2 })
    );

    const endProfit = await StakingBNB.profitOf(user2);

    assert(startProfit.eq(endProfit));
  });

  it("Should claim saved profit after selling", async () => {
    const { StakingBNB } = await contracts;

    await buy();
    await sendProfit("3000");

    const profit = await StakingBNB.profitOf(user1).then(x => x.toString());

    await timeTravel(24 * 3600 + 1);
    await StakingBNB.balanceOf(user1).then(x => StakingBNB.sell(x));

    const event = await StakingBNB.claimProfit().then(x =>
      x.logs.find(x => x.event == "Claim")
    );
    assert.isDefined(event, "Claim event wasn't found");
    assert.equal(event.args.amount.toString(), profit, "wrong claimed profit");
  });
});
