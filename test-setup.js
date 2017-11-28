const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const sinonChai = require("sinon-chai");
const chaiSubset = require("chai-subset");
chai.use(chaiSubset);
chai.use(sinonChai);
chai.use(chaiAsPromised);
