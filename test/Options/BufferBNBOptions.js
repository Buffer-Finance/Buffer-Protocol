const {assert} = require("chai");

const {
  getContracts,
  timeTravel,
  toWei,
  snapshot,
  revert,
  OptionType,
} = require("../utils/utils.js");
const BN = web3.utils.BN;
const address0 = "0x0000000000000000000000000000000000000000";

contract("BufferBNBOptions(call)", ([user1, user2, user3, user4]) => {
  const contracts = getContracts();

  async function createOption({period, amount, strike, user, type} = {}) {
    /*
      Default values are
      - period = 1 day
      - amount = 0.8 BNB
      - ATM Option
      - user = user2
    */
    const {BNBOptions, StakingBNB, PriceProvider} = await contracts;

    const price = await PriceProvider.latestRoundData().then(x => x.answer);

    const [_period, _amount, _strike, from] = [
      new BN(24 * 3600 * (period || 1)),
      new BN(amount || toWei(0.8)),
      new BN(strike || price),
      user || user2,
    ];
    const _type = type || OptionType.Call;

    const [
      value,
      settlementFee,
      strikeFee,
      periodFee
    ] = await BNBOptions.fees(
      _period,
      _amount,
      _strike,
      _type
    ).then(x => [
      x.total,
      x.settlementFee,
      x.strikeFee,
      x.periodFee
    ]);

    const settlementFeePercentage = await BNBOptions.settlementFeePercentage();
    let expectedSettlementFee = _amount.mul(settlementFeePercentage).div(new BN(100));
    assert(expectedSettlementFee.eq(settlementFee), "Settlement Fee is wrong");

    const getStrikeFee = (_strike, type, _amount, _price) => {
      if (_strike.gt(_price) && type == 1)
          return _strike.sub(_price).mul(_amount).div(_price);
      if (_strike.lt(_price) && type == 2)
          return _price.sub(_strike).mul(_amount).div(_price);
      return new BN(0);
    }
    const _price = new BN(price);
    const _strikeFee = new BN(strikeFee);
    assert(
      getStrikeFee(_strike, type, _amount, _price).eq(_strikeFee),
      "Strike Fee is wrong"
    );

    const impliedVolRate = new BN(await BNBOptions.impliedVolRate.call());

    const sqrt = (x) => {
      let result = x;
      let k = x.div(new BN(2)).add(new BN(1));
      while(k.lt(result)){
        result = k;
        k = x.div(k).add(k).div(new BN(2));
      }
      return result;
    }

    const getPeriodFee = (_amount, _period, _strike, _price, type, impliedVolRate) => {
      const PRICE_DECIMALS = new BN(1e8);
      const speriod = sqrt(_period);

      // console.log(
      //   parseInt(_amount),
      //   parseInt(_period),
      //   parseInt(speriod),
      //   parseInt(impliedVolRate),
      //   parseInt(_strike),
      //   parseInt(_price),
      //   parseInt(PRICE_DECIMALS)
      // );

      if (type == 1){
        return _amount.mul(speriod).mul(impliedVolRate).mul(_strike).div(
          _price.mul(PRICE_DECIMALS)
        );
      }
      else{
        return _amount.mul(speriod).mul(impliedVolRate).mul(_price).div(
          _strike.mul(PRICE_DECIMALS)
        );
      }
    }

    const expectedPeriodFee = getPeriodFee(_amount, _period, _strike, _price, type, impliedVolRate)
    const _periodFee = new BN(periodFee);
    assert(expectedPeriodFee.eq(_periodFee), "Period Fee is wrong");

    const initialAdminBalance = await web3.eth.getBalance(user1);
    const events = await BNBOptions.create(
      _period,
      _amount,
      _strike,
      _type,
      from,
      {
        value,
        from,
      }
    ).then(x => x.logs);
    
    const finalAdminBalance = await web3.eth.getBalance(user1);

    const createEvent = events.filter(event => event.event === "Create")[0];

    const tokenHolder = await BNBOptions.ownerOf.call(createEvent.args.id);

    const transferEvent = events.filter(event => event.event === "Transfer")[0];
    assert.isNotNull(
      transferEvent,
      "'Transfer' event has not been initialized"
    );
    const stakingFeePercentage = await BNBOptions.stakingFeePercentage();
    const stakingAmount = settlementFee.mul(stakingFeePercentage).div(new BN(100));
    const adminFee = settlementFee.sub(stakingAmount);
    const adminBalanceDiff = (new BN(finalAdminBalance)).sub(new BN(initialAdminBalance));

    assert.isNotNull(createEvent, "'Create' event has not been initialized");
    assert.equal(tokenHolder, from, "tokenHolder: wrong value");
    assert.equal(createEvent.args.account, from, "Wrong account");
    assert(value.eq(createEvent.args.totalFee), "Wrong premium value");
    // console.log(parseInt(settlementFee), parseInt(stakingAmount), parseInt(createEvent.args.settlementFee));
    assert(
      stakingAmount.eq(createEvent.args.settlementFee),
      "Wrong settlementFee value"
    );
    assert.equal(transferEvent.args.to, from, "Wrong token owner");
    assert(adminBalanceDiff.eq(adminFee), "adminBalanceDiff: wrong value");

    return createEvent.args;
  }

  it("Should be owned by the first account", async () => {
    const {BNBOptions, BNBPool, StakingBNB, PriceProvider} = await contracts;
    // console.log("BNBOptions ", BNBOptions.address);
    // console.log("BNBPool ", BNBPool.address);
    // console.log("StakingBNB ", StakingBNB.address);
    // console.log("PriceProvider ", PriceProvider.address);

    const OPTION_ISSUER_ROLE = await BNBPool.OPTION_ISSUER_ROLE.call();

    await BNBPool.grantRole(OPTION_ISSUER_ROLE, BNBOptions.address, {from: user1});

    const role = await BNBPool.hasRole.call(
      OPTION_ISSUER_ROLE,
      BNBOptions.address
    );
    assert.equal(
      await BNBOptions.owner.call(),
      user1,
      "The first account isn't the contract owner"
    );
    assert.equal(
      role,
      true,
      "Options contract does not has the OPTION_ISSUER_ROLE"
    );
  });

  it("Should provide funds to the pool", async () => {
    const {BNBPool} = await contracts;
    const value = new BN(toWei(30));
    const initialReferrerBalance = new BN(await web3.eth.getBalance(user1));

    await BNBPool.provide(0, user1, {value, from: user3});

    const finalReferrerBalance = new BN(await web3.eth.getBalance(user1));
    const referrerBalanceDiff = finalReferrerBalance.sub(initialReferrerBalance);

    const refRewardPercent = new BN(await BNBPool.referralRewardPercentage.call());
    const accuracy = new BN(await BNBPool.ACCURACY.call());

    const expectedReferralReward = value.mul(refRewardPercent).div(new BN(100)).div(accuracy);
    // console.log("referrerBalanceDiff", parseInt(referrerBalanceDiff), parseInt(expectedReferralReward));
    assert(
      referrerBalanceDiff.eq(expectedReferralReward),
      "RefReward: wrong value"
    );
  });

  it("Should stake tokens", async () => {
    const {IBFRContract, StakingBNB} = await contracts;
    const ibfrBalance = new BN(toWei(2000));

    await IBFRContract.approve(StakingBNB.address, ibfrBalance, {
      from: user1,
    });

    const lotPrice = await StakingBNB.lotPrice();
    await StakingBNB.buy(
      ibfrBalance.div(lotPrice),
      {from: user1}
    );
  });

  it("Should create an option", async () => {
    const createEvent = await createOption();
    assert(
      createEvent.id.eq(new BN(0)),
      "The first option's ID isn't equal to 0"
    );
  });

  it("Should be able to keep staking fees as zero and then create an option", async () => {
    const {BNBOptions, PriceProvider} = await contracts;
    await BNBOptions.setStakingFeePercentage(
      0,
      {
        from: user1,
      }
    );
    const createEvent = await createOption();
    // assert(
    //   createEvent.id.eq(new BN(0)),
    //   "The first option's ID isn't equal to 0"
    // );
  });

  it("Should be able to create a ITM Call option", async () => {
    const {BNBOptions, PriceProvider} = await contracts;
    const price = await PriceProvider.latestRoundData().then(x => x.answer);
    const createEvent = await createOption({strike: price.add(new BN(20e8)), type: 2});
    // assert(
    //   createEvent.id.eq(new BN(0)),
    //   "The first option's ID isn't equal to 0"
    // );
  });

  it("Should be able to create a ITM Put option", async () => {
    const {BNBOptions, PriceProvider} = await contracts;
    const price = await PriceProvider.latestRoundData().then(x => x.answer);
    const createEvent = await createOption({strike: price.sub(new BN(20e8)), type: 1});
    // assert(
    //   createEvent.id.eq(new BN(0)),
    //   "The first option's ID isn't equal to 0"
    // );
  });

  it("Should be able to create a OTM Put option", async () => {
    const {BNBOptions, PriceProvider} = await contracts;
    const price = await PriceProvider.latestRoundData().then(x => x.answer);
    const createEvent = await createOption({strike: price.add(new BN(20e8)), type: 1});
    // assert(
    //   createEvent.id.eq(new BN(0)),
    //   "The first option's ID isn't equal to 0"
    // );
  });

  it("Should be able to create a OTM Call option", async () => {
    const {BNBOptions, PriceProvider} = await contracts;
    const price = await PriceProvider.latestRoundData().then(x => x.answer);
    const createEvent = await createOption({strike: price.sub(new BN(20e8)), type: 2});
    // assert(
    //   createEvent.id.eq(new BN(0)),
    //   "The first option's ID isn't equal to 0"
    // );
  });

  it("Should exercise an ATM call option when strike is equal to currentPrice at the time of exercising with no profit", async () => {
    const {BNBOptions, PriceProvider} = await contracts;
    const {id} = await createOption({user: user2});
    await PriceProvider.setPrice(new BN(380e8));

    const events = await BNBOptions.exercise(id, {from: user2})
      .then(x => x.logs)
      .catch(x => assert.fail(x.reason || x));

    const exerciseEvent = events.filter(event => event.event === "Exercise")[0];
    const burnEvent = events.filter(event => event.event === "Transfer")[0];

    assert.isNotNull(
      exerciseEvent,
      "'Exercise' event has not been initialized"
    );
    assert.equal(burnEvent.args.to, address0, "Token not burnt");

    assert.equal(
      parseInt(exerciseEvent.args.id),
      id,
      "Wrong option ID has been initialized"
    );

    assert.equal(parseInt(exerciseEvent.args.profit), 0, "Profit should be 0");
  });

  it("Shouldn't exercise an ATM call option when strike is greater than currentPrice at the time of exercising", async () => {
    const {BNBOptions, PriceProvider} = await contracts;
    const {id} = await createOption();
    await PriceProvider.setPrice(new BN(360e8));

    await BNBOptions.exercise(id, {from: user2}).then(
      () => assert.fail("Should cancel"),
      x => {
        assert.equal(x.reason, "Current price is too low");
      }
    );
  });

  it("Shouldn't exercise an ATM put option when currentPrice is greater than strike at the time of exercising", async () => {
      const {BNBOptions, PriceProvider} = await contracts;
      const {id} = await createOption({type: 1});
      const price = await PriceProvider.latestRoundData().then(x => x.answer);
      await PriceProvider.setPrice(price.iadd(new BN(20e8)));
      await BNBOptions.exercise(id, {from: user2}).then(
        () => assert.fail("Should cancel"),
        x => {
          assert.equal(x.reason, "Current price is too high");
        }
      );
    });

  // it("Should payout a profit proportional to the current amount when exercising an ATM put option when currentPrice is lesser than strike at the time of exercising", async () => {
  //   const initialBalance = new BN(await web3.eth.getBalance(user2), 10);
  //   const {BNBOptions, PriceProvider} = await contracts;
  //   const price = await PriceProvider.latestRoundData().then(x => x.answer);
  //   const amount = new BN(toWei(0.8));
  //   const {id} = await createOption({amount: amount, user: user2, type: 1});

  //   let optionData = await BNBOptions.options.call(id);
  //   Object.values(optionData).forEach(x => console.log(parseInt(x)));
    
  //   const newPrice = price.sub(new BN(20e8));
  //   console.log(parseInt(price), parseInt(newPrice));

  //   await PriceProvider.setPrice(newPrice);

  //   const ownerOfOption = await BNBOptions.ownerOf.call(id);
  //   console.log("ownerOfOption", ownerOfOption, user2)

  //   const events = await BNBOptions.exercise(id, {from: user2}).then(x => x.logs);
  //   // console.log(events)

  //   const finalBalance = new BN(await web3.eth.getBalance(user2), 10);
  //   // console.log(parseInt(toWei(0.8)))
  //   let expectedPayout = price.sub(newPrice)
  //   console.log(parseInt(expectedPayout))    
  //   expectedPayout = expectedPayout.mul(amount)
  //   expectedPayout = expectedPayout.div(newPrice);
  //   expectedPayout = parseInt(expectedPayout);
  //   expectedPayout = expectedPayout > lockedAmount ? lockedAmount : expectedPayout

  //   // console.log(typeof(finalBalance));
  //   console.log(expectedPayout, parseInt(finalBalance.sub(initialBalance)))
  //   assert.equal(expectedPayout, parseInt(finalBalance.sub(initialBalance)), "Payout is as expected");
  // });

  it("Should exercise an ATM call option when strike is less than currentPrice at the time of exercising with some profit", async () => {
    const {BNBOptions, PriceProvider} = await contracts;
    const {id} = await createOption();

    const price = await PriceProvider.latestRoundData().then(x => x.answer);
    await PriceProvider.setPrice(price.iadd(new BN(20e8)));

    // await PriceProvider.setPrice(new BN(400e8));

    const events = await BNBOptions.exercise(id, {from: user2})
      .then(x => x.logs)
      .catch(x => assert.fail(x.reason || x));

    const exerciseEvent = events.filter(event => event.event === "Exercise")[0];
    const burnEvent = events.filter(event => event.event === "Transfer")[0];

    assert.isNotNull(
      exerciseEvent,
      "'Exercise' event has not been initialized"
    );
    assert.equal(burnEvent.args.to, address0, "Token not burnt");

    assert.equal(
      parseInt(exerciseEvent.args.id),
      id,
      "Wrong option ID has been initialized"
    );
    assert.notEqual(
      parseInt(exerciseEvent.args.profit),
      0,
      "Profit should not be 0"
    );
  });

  it("Shouldn't exercise other options", async () => {
    const {BNBOptions} = await contracts;
    const {id} = await createOption();

    await BNBOptions.exercise(id, {from: user3}).then(
      () => assert.fail("Exercising a call option should be canceled"),
      x => {
        assert.equal(
          x.reason,
          "msg.sender is not eligible to exercise the option",
          "Wrong error reason"
        );
      }
    );
  });

  it("Shouldn't exercise an expired option", async () => {
    const period = parseInt(Math.random() * 28 + 1);
    const {BNBOptions} = await contracts;
    const {id} = await createOption({period});
    const snapId = await snapshot();

    await timeTravel(period * 24 * 3600 + 1);
    await BNBOptions.exercise(id, {from: user2}).then(
      () => assert.fail("Exercising a call option should be canceled"),
      x => {
        assert.equal(x.reason, "Option has expired", "Wrong error reason");
      }
    );
    await revert(snapId);
  });

  it("Shouldn't unlock an exercised option", async () => {
    const {BNBOptions} = await contracts;
    const {id} = await createOption();
    await BNBOptions.exercise(id, {from: user2});
    const snapId = await snapshot();

    await timeTravel(24 * 3600 + 1);

    // const owner = await BNBOptions.owner.call();

    await BNBOptions.unlock(id).then(
      () => assert.fail("Exercising a call option should be canceled"),
      x => {
        assert.equal(x.reason, "Option is not active", "Wrong error reason");
      }
    );
    await revert(snapId);
  });

  it("Shouldn't unlock an active option", async () => {
    const period = parseInt(Math.random() * 28 + 1);
    const {BNBOptions} = await contracts;
    const {id} = await createOption({period});
    const test = () =>
      BNBOptions.unlock(id).then(
        () => assert.fail("Exercising a call option should be canceled"),
        x => {
          assert.equal(
            x.reason,
            "Option has not expired yet",
            "Wrong error reason"
          );
        }
      );
    await test();
  });

  it("Should unlock an expired option", async () => {
    const {BNBOptions} = await contracts;
    const {id} = await createOption({user: user2});

    const expectedPremium = await BNBOptions.options
      .call(id)
      .then(x => x.premium)
      .then(parseInt);

    const snapId = await snapshot();

    await timeTravel(24 * 3600 * 3);
    const events = await BNBOptions.unlock(id, {from: user3})
      .then(x => x.logs)
      .catch(x => assert.fail(x.reason || x));

    const expireEvent = events.filter(event => event.event === "Expire")[0];
    const burnEvent = events.filter(event => event.event === "Transfer")[0];

    assert.isNotNull(expireEvent, "'Expire' event has not been initialized");
    assert.equal(burnEvent.args.to, address0, "Token not burnt");

    assert.equal(
      parseInt(expireEvent.args.id),
      id,
      "Wrong option ID has been initialized"
    );
    assert.equal(
      parseInt(expireEvent.args.premium),
      expectedPremium,
      "Wrong premium"
    );
    await revert(snapId);
  });

  it("Should unlock multiple expired options", async () => {
    const {BNBOptions} = await contracts;
    let ids = [];
    for (let i = 0; i < 5; i++) {
      const {id} = await createOption({user: user2});
      ids.push(parseInt(id));
    }
    // console.log(ids);

    // const {id} = await createOption({user: user2});

    const getPremium = async (id) => await BNBOptions.options
      .call(id)
      .then(x => x.premium)
      .then(parseInt) 

    // const expectedPremiums = ids.forEach(getPremium);

    const snapId = await snapshot();

    await timeTravel(24 * 3600 * 3);
    const events = await BNBOptions.unlockAll(ids, {from: user3})
      .then(x => x.logs)
      .catch(x => assert.fail(x.reason || x));

    const expireEvents = events.filter(event => event.event === "Expire");
    const burnEvents = events.filter(event => event.event === "Transfer");

    expireEvents.forEach(
      expireEvent => assert.isNotNull(expireEvent, "'Expire' event has not been initialized")
    );

    burnEvents.forEach(
      burnEvent => assert.equal(burnEvent.args.to, address0, "Token not burnt")
    );
    // console.log(expireEvents);
    // const eids = expireEvents.forEach(expireEvent => parseInt(expireEvent.args.id));
    let eids = [];
    for (let i = 0; i < 5; i++) {
      let expireEvent = expireEvents[i];
      eids.push(
        parseInt(expireEvent.args.id)
      );
    }

    // console.log(eids)
    // console.log(ids)

    Array.prototype.equals = function(arr2) {
      return (
        this.length === arr2.length &&
        this.every((value, index) => value === arr2[index])
      );
    };

    assert(
        eids.equals(ids),
        "Wrong option ID has been initialized"
    );

    for(let i=0; i<ids.length; i++){
      assert.equal(
        parseInt(await getPremium(ids[i])),
        parseInt(expireEvents[i].args.premium),
        "Wrong premium"
      )
    }

    await revert(snapId);
  });

  it("Should approve someone to transfer the token on your behalf", async () => {
    const {BNBOptions} = await contracts;
    const {id} = await createOption({user: user2});
    await BNBOptions.approve(user4, id, {from: user2});
    const approvedHolder = await BNBOptions.getApproved.call(id);

    assert.equal(approvedHolder, user4, "User not approved");
  });

  it("Should exercise on someone else's behalf if approved and execution should reward the new holder", async () => {
    const {BNBOptions, PriceProvider, BNBPool} = await contracts;
    const {id} = await createOption({user: user2});

    await BNBOptions.setAutoExerciseStatus(true, {from: user2});
    // console.log("autoExerciseStatus", await BNBOptions.autoExerciseStatus.call(user2));

    const approvedHolder = await BNBOptions.owner.call();
    // console.log("approvedHolder", approvedHolder, user1, user2, user3);
    await PriceProvider.setPrice(new BN(480e8));

    const initialOwnerBalance = await web3.eth.getBalance(user2).then(parseInt);

    const snapId = await snapshot();

    await timeTravel((24 * 3600) - (20 * 60));

    const [events, receipt] = await BNBOptions.exercise(id, {
      from: user1,
    })
      .then(x => [x.logs, x.receipt])
      .catch(x => assert.fail(x.reason || x));

    const finalOwnerBalance = await web3.eth.getBalance(user2).then(parseInt);
    const ownerBalanceDiff = finalOwnerBalance - initialOwnerBalance;

    const lockedAmount = new BN(await BNBOptions.options.call(id).then(x => x.lockedAmount));

    const exerciseEvent = events.filter(event => event.event === "Exercise")[0];
    const burnEvent = events.filter(event => event.event === "Transfer")[0];

    const expectedProfit =
      parseInt(exerciseEvent.args.profit) > parseInt(lockedAmount)
        ? parseInt(lockedAmount)
        : parseInt(exerciseEvent.args.profit);

    // assert.equal(approvedHolder, user4, "User not approved");
    assert.isNotNull(exerciseEvent, "'Exercise' event has not been initialized");
    assert.equal(burnEvent.args.to, address0, "Token not burnt");
    assert.equal(
      (ownerBalanceDiff / 1e18).toFixed(2),
      (expectedProfit / 1e18).toFixed(2),
      "Reward: wrong value"
    );

    await revert(snapId);

  });

  it("Shouldn't allow random user to be able to exercise someone else's option", async () => {
    const {BNBOptions, PriceProvider, BNBPool} = await contracts;
    const {id} = await createOption({user: user2});

    await BNBOptions.setAutoExerciseStatus(false, {from: user2});
    // console.log("autoExerciseStatus", await BNBOptions.autoExerciseStatus.call(user2));

    // const owner = await BNBOptions.owner.call();
    const randomUser = user4;
    assert.notEqual(randomUser, BNBOptions.ownerOf.call(id));
    assert.notEqual(randomUser, BNBOptions.owner.call());

    // console.log("approvedHolder", approvedHolder, user1, user2, user3);
    await PriceProvider.setPrice(new BN(480e8));

    // const initialOwnerBalance = await web3.eth.getBalance(user2).then(parseInt);

    const snapId = await snapshot();

    await timeTravel((24 * 3600) - (20 * 60));

    const test = () =>
      BNBOptions.exercise(id, {from: randomUser}).then(
        () => assert.fail("Exercising an option by a random user should be canceled"),
        x => {
          assert.equal(
            x.reason,
            "msg.sender is not eligible to exercise the option",
            "Wrong error reason"
          );
        }
      );
    await test();

    await revert(snapId);
  });

  it("Shouldn't allow owner to exercise someone else's option is status is not true", async () => {
    const {BNBOptions, PriceProvider, BNBPool} = await contracts;
    await PriceProvider.setPrice(new BN(380e8));

    const {id} = await createOption({user: user2});

    await BNBOptions.setAutoExerciseStatus(false, {from: user2});
    // console.log("autoExerciseStatus", await BNBOptions.autoExerciseStatus.call(user2));

    const owner = await BNBOptions.owner.call();
    // const randomUser = user4;
    // assert.notEqual(randomUser, BNBOptions.ownerOf.call(id));
    // assert.notEqual(randomUser, BNBOptions.owner.call());

    // console.log("approvedHolder", approvedHolder, user1, user2, user3);
    await PriceProvider.setPrice(new BN(480e8));

    // const initialOwnerBalance = await web3.eth.getBalance(user2).then(parseInt);

    const snapId = await snapshot();

    await timeTravel((24 * 3600) - (20 * 60));

    const test = () =>
      BNBOptions.exercise(id, {from: owner}).then(
        () => assert.fail("Exercising an option by a random user should be canceled"),
        x => {
          assert.equal(
            x.reason,
            "msg.sender is not eligible to exercise the option",
            "Wrong error reason"
          );
        }
      );
    await test();

    await revert(snapId);
  });

  it("Shouldn't allow owner to exercise someone else's option is status is true but the option is not in its last half an hour", async () => {
    const {BNBOptions, PriceProvider, BNBPool} = await contracts;
    await PriceProvider.setPrice(new BN(380e8));

    const {id} = await createOption({user: user2});

    await BNBOptions.setAutoExerciseStatus(true, {from: user2});
    // console.log("autoExerciseStatus", await BNBOptions.autoExerciseStatus.call(user2));

    const owner = await BNBOptions.owner.call();
    // const randomUser = user4;
    // assert.notEqual(randomUser, BNBOptions.ownerOf.call(id));
    // assert.notEqual(randomUser, BNBOptions.owner.call());

    // console.log("approvedHolder", approvedHolder, user1, user2, user3);
    await PriceProvider.setPrice(new BN(480e8));

    // const initialOwnerBalance = await web3.eth.getBalance(user2).then(parseInt);

    const snapId = await snapshot();

    await timeTravel((24 * 3600) - (40 * 60));

    const test = () =>
      BNBOptions.exercise(id, {from: owner}).then(
        () => assert.fail("Exercising an option by a random user should be canceled"),
        x => {
          assert.equal(
            x.reason,
            "msg.sender is not eligible to exercise the option",
            "Wrong error reason"
          );
        }
      );
    await test();

    await revert(snapId);
  });

  it("Should transfer the option to someone else", async () => {
    const {BNBOptions, PriceProvider} = await contracts;
    const {id} = await createOption({user: user2});
    await BNBOptions.transferFrom(user2, user1, id, {from: user2});

    const tokenHolder = await BNBOptions.ownerOf.call(id);

    assert.equal(tokenHolder, user1, "Token not transferred");
  });

  it("Should transfer the option to someone else and execution should reward the new holder", async () => {
    const {BNBOptions, PriceProvider, BNBPool} = await contracts;
    await PriceProvider.setPrice(new BN(380e8));

    const {id} = await createOption({user: user2});
    await PriceProvider.setPrice(new BN(480e8));

    await BNBOptions.transferFrom(user2, user3, id, {from: user2});
    const tokenHolder = await BNBOptions.ownerOf.call(id);

    const initialOwnerBalance = await web3.eth.getBalance(user3).then(parseInt);

    const [events, receipt] = await BNBOptions.exercise(id, {
      from: user3,
    })
      .then(x => [x.logs, x.receipt])
      .catch(x => assert.fail(x.reason || x));

    const finalOwnerBalance = await web3.eth.getBalance(user3).then(parseInt);
    const ownerBalanceDiff =
      finalOwnerBalance - initialOwnerBalance + receipt.gasUsed;

    const lockedLiquidity = await BNBPool.lockedLiquidity.call(
      BNBOptions.address,
      id
    );
    const exerciseEvent = events.filter(event => event.event === "Exercise")[0];

    const burnEvent = events.filter(event => event.event === "Transfer")[0];
    const expectedProfit =
      parseInt(exerciseEvent.args.profit) > parseInt(lockedLiquidity.amount)
        ? parseInt(lockedLiquidity.amount)
        : parseInt(exerciseEvent.args.profit);

    assert.equal(tokenHolder, user3, "Token not transferred");
    assert.isNotNull(exerciseEvent, "'Expire' event has not been initialized");
    assert.equal(burnEvent.args.to, address0, "Token not burnt");
    assert.equal(
      (ownerBalanceDiff / 1e18).toFixed(2),
      (expectedProfit / 1e18).toFixed(2),
      "Reward: wrong value"
    );
  });

});
