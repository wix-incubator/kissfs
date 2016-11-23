/// <reference path="../node_modules/@types/mocha/index.d.ts" />
import * as cap from 'chai-as-promised';
import * as chaiSubset from 'chai-subset';
import * as chai from 'chai';
import * as Promise from 'bluebird';

Promise.longStackTraces();

chai.use(chaiSubset);
chai.use(cap);
