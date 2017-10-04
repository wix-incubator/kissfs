import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as sinonChai from 'sinon-chai';
import chaiSubset = require('chai-subset');

chai.use(chaiSubset);
chai.use(sinonChai);
chai.use(chaiAsPromised);
