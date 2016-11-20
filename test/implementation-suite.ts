import {expect} from "chai";
import {FileSystem} from '../src/api';
import * as Promise from 'bluebird';

export type Options = {
    eventChangesPollingInterval:number;
    noExtraEventsGrace:number;
    timeout:number;
};
export function assertFileSystemContract(fsProvider: () => FileSystem, options:Options) {
    describe('filesystem contract', () => {
        let fs: FileSystem;
        let events: Array<any>;
        beforeEach(() => {
            fs = fsProvider();
            events = [];
            fs.events.addListener('fileCreated', handleEvent('fileCreated'));
            fs.events.addListener('fileChanged', handleEvent('fileChanged'));
            fs.events.addListener('fileDeleted', handleEvent('fileDeleted'));
            fs.events.addListener('directoryCreated', handleEvent('directoryCreated'));
            fs.events.addListener('directoryDeleted', handleEvent('directoryDeleted'));
        });

        afterEach(() => {
            expect(events, 'unmatched events after test case').to.eql([]);
        });

        function handleEvent(eventName:string){
            return event => {
                expect(event.type, `type of event dispatched as ${eventName}`).to.eql(eventName);
                events.push(event);
            }
        }

        function expectEvents(...expectedEvents){
            return Promise.resolve()
                .then(() => {
                    expect(events).to.eql(expectedEvents);
                    events = [];
                })
                .then(()=> Promise.delay(options.noExtraEventsGrace).then(() => expect(events).to.eql([])),
                    () => Promise.delay(options.eventChangesPollingInterval).then(() => expectEvents(...expectedEvents)))
                .timeout(options.timeout, new Error('timed out waiting for events'));
        }

        it(`initially empty`, function() {
            return expect(fs.loadDirectoryTree()).to.become({type:'dir', name:'', fullPath:'', children:[]});
        });

        it(`loading a non-existing file - fails`, function() {
            return expect(fs.loadTextFile('foo.txt')).to.be.rejectedWith(Error);
        });

        it(`loading a non-existing file - fails`, function() {
            return fs.ensureDirectory('foo')
                .then(() => expectEvents({type: 'directoryCreated', fullPath:'foo'}))
                .then(() => expect(fs.loadTextFile('foo')).to.be.rejectedWith(Error));
        });

        it(`saving an illegal file name - fails`, function() {
            return expect(fs.saveFile('', 'baz')).to.be.rejectedWith(Error);
        });

        it(`ensuring existence of directory`, function() {
            const expectedStructure = {
                type:'dir', name:'', fullPath:'', children:[
                    {type:'dir', name:'foo.bar', fullPath:'foo.bar', children:[]}
                ]};
            return fs.ensureDirectory('foo.bar')
                .then(() => expectEvents({type: 'directoryCreated', fullPath:'foo.bar'}))
                .then(() => expect(fs.loadDirectoryTree()).to.become(expectedStructure))
                .then(() => fs.ensureDirectory('foo.bar')) //2nd time does nothing
                .then(() => expect(fs.loadDirectoryTree()).to.become(expectedStructure))
        });

        it(`saving a file over a directory - fails`, function() {
            return fs.ensureDirectory('foo')
                .then(() => expectEvents({type: 'directoryCreated', fullPath:'foo'}))
                .then(() => expect(fs.saveFile('foo', 'bar')).to.be.rejectedWith(Error))
                .then(() => expect(fs.loadDirectoryTree()).to.become({
                    type:'dir', name:'', fullPath:'', children:[
                        {type:'dir', name:'foo', fullPath:'foo', children:[]}
                    ]}));
        });

        it(`saving a new file (and a new directory to hold it)`, function() {
            return fs.saveFile('foo/bar.txt', 'baz')
                .then(() => expectEvents({type: 'directoryCreated', fullPath:'foo'}, {type: 'fileCreated', fullPath:'foo/bar.txt', newContent:'baz'}))
                .then(() => expect(fs.loadDirectoryTree()).to.become({
                    type:'dir', name:'', fullPath:'', children:[
                        {type:'dir', name:'foo', fullPath:'foo', children:[
                            {type:'file', name:'bar.txt', fullPath:'foo/bar.txt'}]}]}));
        });

        it(`saving a file with different content`, function() {
            return fs.saveFile('foo.txt', 'bar')
                .then(() => expectEvents({type: 'fileCreated', fullPath:'foo.txt', newContent:'bar'}))
                .then(() => expect(fs.loadTextFile('foo.txt')).to.become('bar'))
                .then(() => fs.saveFile('foo.txt', 'baz'))
                .then(() => expectEvents({type: 'fileChanged', fullPath:'foo.txt', newContent:'baz'}))
                .then(() => expect(fs.loadTextFile('foo.txt')).to.become('baz'));
        });

        it(`saving a file with same content`, function() {
            return fs.saveFile('foo.txt', 'bar')
                .then(() => expectEvents({type: 'fileCreated', fullPath:'foo.txt', newContent:'bar'}))
                .then(() => expect(fs.loadTextFile('foo.txt')).to.become('bar'))
                .then(() => fs.saveFile('foo.txt', 'bar'))
                .then(() => expect(fs.loadTextFile('foo.txt')).to.become('bar'));
        });

        it(`deleting root directory - fails`, function() {
            return expect(fs.deleteDirectory('')).to.be.rejectedWith(Error);
        });

        it(`deleting non existing directory succeeds`, function() {
            return fs.deleteDirectory('foo/bar')
                .then(() => expect(fs.loadDirectoryTree()).to.eventually.have.property('children').eql([]));
        });

        it(`deleting directory which is actually a file - fails`, function() {
            return fs.saveFile('foo.txt', 'foo')
                .then(() => expectEvents({type: 'fileCreated', fullPath:'foo.txt', newContent:'foo'}))
                .then(() => expect(fs.deleteDirectory('foo.txt')).to.be.rejectedWith(Error));
        });

        it(`deleting non-empty directory without recursive flag - fails`, function() {
            return fs.saveFile('foo/bar/baz.txt', 'foo')
                .then(() => expectEvents(
                    {type: 'directoryCreated', fullPath:'foo'},
                    {type: 'directoryCreated', fullPath:'foo/bar'},
                    {type: 'fileCreated', fullPath:'foo/bar/baz.txt', newContent:'foo'}))
                .then(() => expect(fs.deleteDirectory('foo/bar')).to.be.rejectedWith(Error));
        });

        it(`deleting only one file`, function() {
            return fs.saveFile('foo.txt', 'foo')
                .then(() => expectEvents({type: 'fileCreated', fullPath:'foo.txt', newContent:'foo'}))
                .then(() => fs.saveFile('bar.txt','bar'))
                .then(() => expectEvents({type: 'fileCreated', fullPath:'bar.txt', newContent:'bar'}))
                .then(() => fs.deleteFile('bar.txt'))
                .then(() => expectEvents({type: 'fileDeleted', fullPath:'bar.txt'}))
                .then(() => expect(fs.loadDirectoryTree()).to.eventually.have.property('children').eql([{fullPath:'foo.txt', name:'foo.txt', type:'file'}]));
        });

        it(`deleting non existing file succeeds`, function() {
            return fs.deleteFile('foo/bar.txt')
                .then(() => expect(fs.loadDirectoryTree()).to.eventually.have.property('children').eql([]));
        });
    });
}

