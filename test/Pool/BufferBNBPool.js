const {assert} = require("chai");

const {
  getContracts,
  timeTravel,
  toWei,
  snapshot,
  revert,
  OptionType,
  MAX_INTEGER
} = require("../utils/utils.js");
const BN = web3.utils.BN;
const address0 = "0x0000000000000000000000000000000000000000";

const firstProvide = new BN(toWei(Math.random()))
const secondProvide = new BN(toWei(Math.random()))
const thirdProvide = new BN(toWei(Math.random()))
const firstWithdraw = firstProvide
const profit = new BN(toWei(Math.random())).div(new BN(1000));

contract("BufferBNBPool", ([user1, user2, user3]) => {
  const contracts = getContracts()

  it("Should transfer ownership", async () => {
    const {BNBPool} = await contracts;

    const OPTION_ISSUER_ROLE = await BNBPool.OPTION_ISSUER_ROLE.call();
    await BNBPool.grantRole(OPTION_ISSUER_ROLE, user3, {from: user1})
    // Error: Returned error: VM Exception while processing transaction: revert AccessControl: account 0xd8c31378f34b1a1142faff4d624f601401c5cda2 is missing role 0x0000000000000000000000000000000000000000000000000000000000000000 -- Reason given: AccessControl: account 0xd8c31378f34b1a1142faff4d624f601401c5cda2 is missing role 0x0000000000000000000000000000000000000000000000000000000000000000.


    const DEFAULT_ADMIN_ROLE = await BNBPool.DEFAULT_ADMIN_ROLE.call();
    await BNBPool.revokeRole(DEFAULT_ADMIN_ROLE, user1, {from: user1})
  })

  it("Should mint tokens for the first provider correctly", async () => {
    const {BNBPool} = await contracts
    await BNBPool.provide(0, user1, {value: firstProvide, from: user1})
    const shareOf = new BN(await BNBPool.shareOf(user1))

    // const refRewardPercent = new BN(await BNBPool.referralRewardPercentage.call());
    // const accuracy = new BN(await BNBPool.ACCURACY.call());

    // const expectedReferralReward = firstProvide.mul(refRewardPercent).div(new BN(100)).div(accuracy);

    // const amount = firstProvide.sub(expectedReferralReward)
    assert(
      shareOf.eq(firstProvide),
      "Wrong amount"
    )
  })

  it("Should mint tokens for the second provider correctly", async () => {
    const {BNBPool} = await contracts
    await BNBPool.provide(0, user2, {value: secondProvide, from: user2})
    assert(
      await BNBPool.shareOf(user2).then((x) => x.eq(secondProvide)),
      "Wrong amount"
    )
  })

  it("Should distribute the profits correctly", async () => {
    const {BNBPool} = await contracts
    const value = profit
    const [startShare1, startShare2] = await Promise.all([
      BNBPool.shareOf(user1),
      BNBPool.shareOf(user2),
    ])

    const expected1 = value
      .mul(startShare1)
      .div(startShare1.add(startShare2))
      .add(startShare1)
    const expected2 = value
      .mul(startShare2)
      .div(startShare1.add(startShare2))
      .add(startShare2)

    await BNBPool.lock(0,0,{value, from: user3})
    await BNBPool.unlock(0, {from:user3})

    const [res1, res2] = await Promise.all([
      BNBPool.shareOf(user1).then((x) => x.eq(expected1)),
      BNBPool.shareOf(user2).then((x) => x.eq(expected2)),
    ])
    assert(res1 && res2, "The profits value isn't correct")
  })

  it("Should mint tokens for the third provider correctly", async () => {
    const {BNBPool} = await contracts
    const value = thirdProvide
    const [startShare1, startShare2] = await Promise.all([
      BNBPool.shareOf(user1),
      BNBPool.shareOf(user2),
    ])
    await BNBPool.provide(0, user3, {value, from: user3})
    assert.isAtLeast(
      await BNBPool.shareOf(user3).then((x) => x.sub(value).toNumber()),
      -1,
      "The third provider has lost funds"
    )
    assert(
      await BNBPool.shareOf(user1).then((x) => x.eq(startShare1)),
      "The first provider has an incorrect share"
    )
    assert(
      await BNBPool.shareOf(user2).then((x) => x.eq(startShare2)),
      "The second provider has an incorrect share"
    )
  })

  it("Should burn the first provider's tokens correctly", async () => {
    const {BNBPool} = await contracts
    const value = firstWithdraw
    const startBalance = await web3.eth.getBalance(user1).then((x) => new BN(x))

    const [startShare1, startShare2, startShare3] = await Promise.all([
      BNBPool.shareOf(user1),
      BNBPool.shareOf(user2),
      BNBPool.shareOf(user3),
    ])

    await timeTravel(14 * 24 * 3600 + 1)
    const gasPrice = await web3.eth.getGasPrice().then((x) => new BN(x))
    const transactionFee = await BNBPool.withdraw(value, MAX_INTEGER)
      .then((x) => new BN(x.receipt.gasUsed))
      .then((x) => x.mul(gasPrice))
    const endBalance = await web3.eth.getBalance(user1).then((x) => new BN(x))
    const balanceDelta = endBalance.add(transactionFee).sub(startBalance)

    const [share1, share2, share3] = await Promise.all([
      BNBPool.shareOf(user1),
      BNBPool.shareOf(user2),
      BNBPool.shareOf(user3),
    ])
    assert.isAtLeast(
      share2.sub(startShare2).toNumber(),
      -1,
      "The second user has lost funds"
    )
    assert.isAtLeast(
      share3.sub(startShare3).toNumber(),
      -1,
      "The third user has lost funds"
    )
    assert.equal(
      share1.add(value).sub(startShare1),
      0,
      "The first provider has an incorrect share"
    )
  })
})
