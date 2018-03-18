import {EventsMatcher} from './events-matcher';
import {EventEmitter} from 'eventemitter3';
import {expect} from 'chai';

describe('events test driver', () => {

    let matcher: EventsMatcher;
    let emitter: EventEmitter;

    beforeEach(() => {
        emitter = new EventEmitter();
        matcher = new EventsMatcher({retries: 5, interval: 10, noExtraEventsGrace: 20});
        matcher.track(emitter as any, 'event' as any);
    });

    it('failure when event has no type field', () => {
        return expect(() => emitter.emit('event', {foo: 'bar'})).to.throw(Error);
    });

    it('failure when event has incorrect type field', () => {
        return expect(() => emitter.emit('event', {type: 'eventz', foo: 'bar'})).to.throw(Error);
    });

    it('success when existing events', () => {
        emitter.emit('event', {type: 'event', foo: 'bar'});
        return matcher.expect([{type: 'event', foo: 'bar'}]);
    });

    it('success when subset events', () => {
        emitter.emit('event', {type: 'event', foo: 'bar'});
        return matcher.expect([{type: 'event'}]);
    });

    it('error contains original chai data', () => {
        emitter.emit('event', {type: 'event', foo: 'bar'});
        var rejection = matcher.expect([{type: 'event', foo: 'baz'}]).catch(e => e);
        return expect(rejection).to.eventually.satisfy(
            (err: object) => expect(err).to.containSubset({actual: [{foo: 'bar'}], expected: [{foo: 'baz'}]}));
    });

    it('failure when mismatched events', () => {
        emitter.emit('event', {type: 'event', foo: 'bar'});
        return expect(matcher.expect([{
            type: 'event',
            foo: 'baz'
        }])).to.be.rejectedWith(/{ type: 'event', foo: 'bar' }/);
    });

    it('success when matching delayed events', () => {
        const result = matcher.expect([{type: 'event', foo: 'bar'}]);
        setTimeout(() => emitter.emit('event', {type: 'event', foo: 'bar'}), 25);
        return result;
    });

    describe('.expect() ignores argument if options.alwaysExpectEmpty is true', () => {
        let matcher: EventsMatcher;
        let emitter: EventEmitter;

        beforeEach(() => {
            emitter = new EventEmitter();
            matcher = new EventsMatcher({alwaysExpectEmpty: true, retries: 5, interval: 10, noExtraEventsGrace: 20});
            matcher.track(emitter as any, 'event' as any);
        });


        it('success when matching empty events', () => {
            return matcher.expect([{type: 'event', foo: 'bar'}]);
        });

        it('failure when matching non-empty events', () => {
            emitter.emit('event', {type: 'event', foo: 'bar'});
            return expect(matcher.expect([{
                type: 'event',
                foo: 'bar'
            }])).to.be.rejectedWith(/{ type: 'event', foo: 'bar' }/);
        });
    });
});
