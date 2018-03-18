import chai = require("chai");
import chaiAsPromised = require("chai-as-promised");
import sinonChai = require("sinon-chai");
import chaiSubset = require("chai-subset");

chai.use(chaiSubset);
chai.use(sinonChai);
chai.use(chaiAsPromised);
