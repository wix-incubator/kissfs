import {EventsMatcher} from '../drivers/events-matcher';
import {EventEmitter} from 'eventemitter3';
import {expect} from 'chai';

describe('events test driver', ()=>{

    let matcher: EventsMatcher;
    let emitter: EventEmitter;

    beforeEach(() => {
        emitter = new EventEmitter();
        matcher = new EventsMatcher({interval: 10, timeout: 100, noExtraEventsGrace:20});
    });

    it('failure when event has no type field', () => {
        matcher.track(emitter, 'event');
        return expect(()=>emitter.emit('event', {foo:'bar'})).to.throw(Error);
    });

    it('failure when event has incorrect type field', () => {
        matcher.track(emitter, 'event');
        return expect(()=>emitter.emit('event', {type:'eventz', foo:'bar'})).to.throw(Error);
    });

    it('success when existing events', () => {
        matcher.track(emitter, 'event');
        emitter.emit('event', {type:'event', foo:'bar'});
        return matcher.expect([{type:'event', foo:'bar'}]);
    });

    it('success when subset events', () => {
        matcher.track(emitter, 'event');
        emitter.emit('event', {type:'event', foo:'bar'});
        return matcher.expect([{type:'event'}]);
    });

    it('error contains original chai data', () => {
        matcher.track(emitter, 'event');
        emitter.emit('event', {type:'event', foo:'bar'});
        var rejection = matcher.expect([{type:'event', foo:'baz'}]).catch(e => e);
        return expect(rejection).to.eventually.satisfy(
            (err: object) => expect(err).to.containSubset({actual:[{foo:'bar'}], expected:[{foo:'baz'}]}));
    });

    it('failure when mismatched events', () => {
        matcher.track(emitter, 'event');
        emitter.emit('event', {type:'event', foo:'bar'});
        return expect(matcher.expect([{type:'event', foo:'baz'}])).to.be.rejectedWith(/{ type: 'event', foo: 'bar' }/);
    });

    it('success when matching delayed events', () => {
        matcher.track(emitter, 'event');
        const result = matcher.expect([{type:'event', foo:'bar'}]);
        setTimeout(() => emitter.emit('event', {type:'event', foo:'bar'}), 25);
        return result;
    });
});
