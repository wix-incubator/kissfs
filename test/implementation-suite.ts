import {expect} from "chai";
import {FileSystem, FileSystemNode, FileCreatedEvent, FileDeletedEvent, Directory} from '../src/api';
import * as Promise from 'bluebird';

export function assertFileSystemContract(fsProvider: () => FileSystem) {
    describe('filesystem contract', () => {
        let fs: FileSystem;
        let events: Array<any>;
        beforeEach(() => {
            fs = fsProvider();
            events = [];
           // fs.events.addListener()
        });

// TODO add events expectations

        it(`initially empty`, function() {
            return expect(fs.loadDirectoryTree()).to.become({type:'dir', name:'', fullPath:'', children:[]});
        });

        it(`loading a non-existing file - fails`, function() {
            return expect(fs.loadTextFile('foo.txt')).to.be.rejectedWith(Error);
        });

        it(`loading a non-existing file - fails`, function() {
            return fs.ensureDirectory('foo')
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
                .then(() => expect(fs.loadDirectoryTree()).to.become(expectedStructure))
                .then(() => fs.ensureDirectory('foo.bar')) //2nd time does nothing
                .then(() => expect(fs.loadDirectoryTree()).to.become(expectedStructure))
        });

        it(`saving a file over a directory - fails`, function() {
            return fs.ensureDirectory('foo')
                .then(() => expect(fs.saveFile('foo', 'bar')).to.be.rejectedWith(Error))
                .then(() => expect(fs.loadDirectoryTree()).to.become({
                    type:'dir', name:'', fullPath:'', children:[
                        {type:'dir', name:'foo', fullPath:'foo', children:[]}
                    ]}));
        });

        it(`saving a new file (and a new directory to hold it)`, function() {
            return fs.saveFile('foo/bar.txt', 'baz')
                .then(() => expect(fs.loadDirectoryTree()).to.become({
                    type:'dir', name:'', fullPath:'', children:[
                        {type:'dir', name:'foo', fullPath:'foo', children:[
                            {type:'file', name:'bar.txt', fullPath:'foo/bar.txt'}]}]}));
        });

        it(`saving a file with different content`, function() {
            return fs.saveFile('foo.txt', 'bar')
                .then(() => expect(fs.loadTextFile('foo.txt')).to.become('bar'))
                .then(() => fs.saveFile('foo.txt', 'baz'))
                .then(() => expect(fs.loadTextFile('foo.txt')).to.become('baz'));
        });

        it(`saving a file with same content`, function() {
            return fs.saveFile('foo.txt', 'bar')
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
            return fs.saveFile('foo/bar/baz.txt', 'foo')
                .then(() => expect(fs.deleteDirectory('foo/bar/baz.txt')).to.be.rejectedWith(Error));
        });

        it(`deleting non-empty directory without recursive flag - fails`, function() {
            return fs.saveFile('foo/bar/baz.txt', 'foo')
                .then(() => expect(fs.deleteDirectory('foo/bar')).to.be.rejectedWith(Error));
        });

        it(`deleting only one file`, function() {
            return fs.saveFile('foo.txt', 'foo')
                .then(() => fs.saveFile('bar.txt','bar'))
                .then(() => fs.deleteFile('bar.txt'))
                .then(() => expect(fs.loadDirectoryTree()).to.eventually.have.property('children').eql([{fullPath:'foo.txt', name:'foo.txt', type:'file'}]));
        });

        it(`deleting non existing file succeeds`, function() {
            return fs.deleteFile('foo/bar.txt')
                .then(() => expect(fs.loadDirectoryTree()).to.eventually.have.property('children').eql([]));
        });

        it(`listens to file changes`, function() {
            const newValue = 'newValue';
            const fileName = 'index.html';

            const gotEvent =  new Promise((resolve, reject) => {
                fs.events.on('fileChanged', function(event:FileCreatedEvent) {
                    try{
                        expect(event.newContent).to.equal(newValue);
                        expect(event.fullPath).to.equal(fileName);
                        resolve();
                    } catch(error){
                        reject(error);
                    }
                });
            });
            return Promise.all([fs.saveFile(fileName, newValue), gotEvent]);

        });

        it(`listen to file delete`, function(){
            const expectedFileName = 'src/file.txt';
            return fs.saveFile(expectedFileName,'content')
                .then(() => {
                    const gotEvent =  new Promise((resolve, reject) => {
                        fs.events.on('fileDeleted', function(event) {
                            try{
                                expect(event.fullPath).to.equal(expectedFileName);
                                resolve();
                            } catch(error){
                                reject(error);
                            }
                        });
                    });
                    return Promise.all([fs.deleteFile(expectedFileName), gotEvent]);
                });
        });
    });
}

