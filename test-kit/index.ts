import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import chaiSubset = require('chai-subset');
import * as Promise from 'bluebird';

Promise.longStackTraces();

chai.use(chaiSubset);
chai.use(chaiAsPromised);
