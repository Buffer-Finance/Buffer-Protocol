![Buffer](https://github.com/Buffer-Finance/Buffer-Protocol/blob/master/Twitter.png?raw=true)

## Prerequisities

-   [Node.js v12.20.2][1]

## Install

```bash
npm install
```

## Tasks

### Start ganache

```bash
npm run ganache
```

### Run tests

```bash
npm run test
```

### Generate code coverage

```bash
npm run coverage
```

--------------------------|----------|----------|----------|----------|----------------|
File                      |  % Stmts | % Branch |  % Funcs |  % Lines |Uncovered Lines |
--------------------------|----------|----------|----------|----------|----------------|
 contracts/               |       60 |      100 |       60 |       60 |                |
  TestImplementations.sol |       60 |      100 |       60 |       60 |          49,53 |
 contracts/Interfaces/    |      100 |      100 |      100 |      100 |                |
  Interfaces.sol          |      100 |      100 |      100 |      100 |                |
 contracts/Options/       |     83.5 |    59.26 |    70.83 |    83.33 |                |
  BufferBNBOptions.sol    |     83.5 |    59.26 |    70.83 |    83.33 |... 299,423,442 |
 contracts/Pool/          |    70.33 |    51.79 |    78.57 |    71.76 |                |
  BufferBNBPool.sol       |    70.33 |    51.79 |    78.57 |    71.76 |... 280,281,282 |
 contracts/Staking/       |    97.78 |       85 |    94.44 |    97.73 |                |
  BufferStaking.sol       |    96.77 |    81.25 |    91.67 |    96.67 |             75 |
  BufferStakingBNB.sol    |      100 |      100 |      100 |      100 |                |
  BufferStakingIBFR.sol   |      100 |      100 |      100 |      100 |                |
 contracts/Token/         |      100 |      100 |      100 |      100 |                |
  IBFR.sol                |      100 |      100 |      100 |      100 |                |
--------------------------|----------|----------|----------|----------|----------------|
All files                 |    80.89 |       60 |    79.03 |    81.51 |                |
--------------------------|----------|----------|----------|----------|----------------|


[1]: https://nodejs.org/

## Testnet Contracts

### BufferBNBOptions
[0x672311F8b6e426E8Cf754d59697f0A23A68AB58F](https://testnet.bscscan.com/address/0x672311F8b6e426E8Cf754d59697f0A23A68AB58F#contracts)

### BufferStakingBNB
[0x5e53D39d6f3e84f06Ab6Ae68428cdfB9F47814D5](https://testnet.bscscan.com/address/0x5e53D39d6f3e84f06Ab6Ae68428cdfB9F47814D5#contracts)

### BufferStakingIBFR
[0xdFE2d486f9C022de5313831a8ebFa8a1aeCb384C](https://testnet.bscscan.com/address/0xdFE2d486f9C022de5313831a8ebFa8a1aeCb384C#contracts)

### BufferBNBPool
[0x28366AAbF3dA1268271c7f0C6dfEADAf4E98F87e](https://testnet.bscscan.com/address/0x28366AAbF3dA1268271c7f0C6dfEADAf4E98F87e#contracts)

### IBFR
[0x18D69A2368E3F12cbE221E6a8249A8C19dC24637](https://testnet.bscscan.com/address/0x18D69A2368E3F12cbE221E6a8249A8C19dC24637#contracts)

### FakePriceProvider

> Only being used for testing, We'll be using Chainlink on the mainnet

#### [0x200073FfA24625e003ECd84f04518D08Bb5345b7](https://testnet.bscscan.com/address/0x200073FfA24625e003ECd84f04518D08Bb5345b7#contracts)
