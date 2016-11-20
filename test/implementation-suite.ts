import {expect} from "chai";
import {FileSystem, FileSystemNode, FileChangeEvent, FileDeleteEvent, Directory} from '../src/types/api';
import * as Promise from 'bluebird';

export function assertFileSystemContract(fsProvider: () => FileSystem) {
    describe('filesystem contract', () => {
        let fs: FileSystem;

        beforeEach(() => {
            fs = fsProvider();
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
            return fs.ensureDirectory('foo')
                .then(() => expect(fs.loadDirectoryTree()).to.become({
                    type:'dir', name:'', fullPath:'', children:[
                        {type:'dir', name:'foo', fullPath:'foo', children:[]}
                    ]}));
        });

        it(`saving a file over a folder - fails`, function() {
            return fs.ensureDirectory('foo')
                .then(() => expect(fs.saveFile('foo', 'bar')).to.be.rejectedWith(Error))
                .then(() => expect(fs.loadDirectoryTree()).to.become({
                    type:'dir', name:'', fullPath:'', children:[
                        {type:'dir', name:'foo', fullPath:'foo', children:[]}
                    ]}));
        });

        it(`saving a new file (and a new folder to hold it)`, function() {
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
                fs.events.on('fileChanged', function(event:FileChangeEvent) {
                    try{
                        expect(event.newContent).to.equal(newValue);
                        expect(event.filename).to.equal(fileName);
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
                        fs.events.on('fileDeleted', function(event:FileDeleteEvent) {
                            try{
                                expect(event.filename).to.equal(expectedFileName);
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

