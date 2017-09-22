import {expect} from "chai";
import {FileSystem, fileSystemEventNames, pathSeparator} from '../src/universal';
import {EventsMatcher} from '../test-kit/drivers/events-matcher';
import * as Promise from 'bluebird';
import {EventEmitter} from 'eventemitter3';


export const dirName = 'foo';
export const fileName = 'bar.txt';
export const content = 'content';
export const ignoredDir = 'ignored';
export const ignoredFile = `${dirName}${pathSeparator}ignored.txt`;

export function assertFileSystemContract(fsProvider: () => Promise<FileSystem>, options:EventsMatcher.Options) {
    describe(`filesystem contract`, () => {
        let fs: FileSystem;
        let matcher: EventsMatcher;
        beforeEach(() => {
            matcher = new EventsMatcher(options);
            return fsProvider()
                .then(newFs => {
                    fs = newFs;
                    matcher.track(fs.events as any as EventEmitter, ...fileSystemEventNames);
                });
        });

        it(`initially empty`, function() {
            return expect(fs.loadDirectoryTree()).to.become({type:'dir', name:'', fullPath:'', children:[]});
        });

        it(`loading a non-existing file - fails`, function() {
            return expect(fs.loadTextFile(fileName)).to.be.rejectedWith(Error);
        });

        it(`loading a directory as a file - fails`, function() {
            return fs.ensureDirectory(dirName)
                .then(() => {
                    return matcher.expect([{type: 'directoryCreated', fullPath:dirName}])
                })
                .then(() => expect(fs.loadTextFile(dirName)).to.be.rejectedWith(Error))
                .then(() => matcher.expect([]));
        });

        it(`saving an illegal file name - fails`, function() {
            return expect(fs.saveFile('', content)).to.be.rejectedWith(Error)
                .then(() => matcher.expect([]));
        });

        it(`ensuring existence of directory`, function() {
            const dirName = fileName;
            const expectedStructure = {
                type:'dir', name:'', fullPath:'', children:[
                    {type:'dir', name:dirName, fullPath:dirName, children:[]}
                ]};
            return fs.ensureDirectory(dirName)
                .then(() => matcher.expect([{type: 'directoryCreated', fullPath:dirName}]))
                .then(() => expect(fs.loadDirectoryTree()).to.become(expectedStructure))
                .then(() => fs.ensureDirectory(dirName)) //2nd time does nothing
                .then(() => expect(fs.loadDirectoryTree()).to.become(expectedStructure))
                .then(() => matcher.expect([]))
        });

        it(`saving a file over a directory - fails`, function() {
            return fs.ensureDirectory(dirName)
                .then(() => matcher.expect([{type: 'directoryCreated', fullPath:dirName}]))
                .then(() => expect(fs.saveFile(dirName, content)).to.be.rejectedWith(Error))
                .then(() => expect(fs.loadDirectoryTree()).to.become({
                    type:'dir', name:'', fullPath:'', children:[
                        {type:'dir', name:dirName, fullPath:dirName, children:[]}
                    ]}))
                .then(() => matcher.expect([]));
        });

        it(`saving a file over a file in its path - fails`, function() {
            const fileNameAsDir = dirName;
            return fs.saveFile(fileNameAsDir, content)
                .then(() => matcher.expect([{type: 'fileCreated', fullPath:fileNameAsDir, newContent:content}]))
                .then(() => expect(fs.saveFile(`${fileNameAsDir}/${fileName}`, '_${content}')).to.be.rejectedWith(Error))
                .then(() => expect(fs.loadDirectoryTree()).to.become({
                    type:'dir', name:'', fullPath:'', children:[
                        {type:'file', name:fileNameAsDir, fullPath:fileNameAsDir}
                    ]}))
                .then(() => matcher.expect([]));
        });

        it(`saving a new file (and a new directory to hold it)`, function() {
            return fs.saveFile(`${dirName}/${fileName}`, content)
                .then(() => matcher.expect([{type: 'directoryCreated', fullPath:dirName}, {type: 'fileCreated', fullPath:`${dirName}/${fileName}`, newContent:content}]))
                .then(() => expect(fs.loadDirectoryTree()).to.become({
                    type:'dir', name:'', fullPath:'', children:[
                        {type:'dir', name:dirName, fullPath:dirName, children:[
                            {type:'file', name:fileName, fullPath:`${dirName}/${fileName}`}]}]}))
                .then(() => matcher.expect([]));
        });

        it(`saving a file with different content`, function() {
            const newContent = `_${content}`;
            return fs.saveFile(fileName, content)
                .then(() => matcher.expect([{type: 'fileCreated', fullPath:fileName, newContent:content}]))
                .then(() => expect(fs.loadTextFile(fileName)).to.become(content))
                .then(() => fs.saveFile(fileName, newContent))
                .then(() => matcher.expect([{type: 'fileChanged', fullPath:fileName, newContent:newContent}]))
                .then(() => expect(fs.loadTextFile(fileName)).to.become(newContent))
                .then(() => matcher.expect([]));
        });

        it(`saving a file with same content`, function() {
            const expectedStructure = {
                type:'dir', name:'', fullPath:'', children:[
                    {name: fileName, fullPath: fileName, type: 'file'}
                ]};

            return fs.saveFile(fileName, content)
                .then(() => matcher.expect([{type: 'fileCreated', fullPath:fileName, newContent:content}]))
                .then(() => expect(fs.loadTextFile(fileName)).to.become(content))
                .then(() => fs.saveFile(fileName, content)) // may or may not trigger an event
                .then(() => expect(fs.loadDirectoryTree()).to.become(expectedStructure))
                .then(() => expect(fs.loadTextFile(fileName)).to.become(content));
        });

        it(`deleting root directory - fails`, function() {
            return expect(fs.deleteDirectory('')).to.be.rejectedWith(Error)
                .then(() => matcher.expect([]));
        });

        it(`deleting a directory`, function() {
            return fs.ensureDirectory(`${dirName}/_${dirName}`)
                .then(() => matcher.expect([
                    {type: 'directoryCreated', fullPath:dirName},
                    {type: 'directoryCreated', fullPath:`${dirName}/_${dirName}`}]))
                .then(() => fs.deleteDirectory(`${dirName}/_${dirName}`))
                .then(() => matcher.expect([{type: 'directoryDeleted', fullPath:`${dirName}/_${dirName}`}]))
                .then(() => expect(fs.loadDirectoryTree()).to.eventually.have.property('children').eql([
                    {children:[], fullPath:dirName, name:dirName, type:'dir'}]))
                .then(() => matcher.expect([]));
        });

        it(`deleting non existing directory succeeds`, function() {
            return fs.deleteDirectory(`${dirName}/_${dirName}`)
                .then(() => expect(fs.loadDirectoryTree()).to.eventually.have.property('children').eql([]))
                .then(() => matcher.expect([]));
        });

        it(`deleting directory which is actually a file - fails`, function() {
            return fs.saveFile(fileName, content)
                .then(() => matcher.expect([{type: 'fileCreated', fullPath:fileName, newContent:content}]))
                .then(() => expect(fs.deleteDirectory(fileName)).to.be.rejectedWith(Error))
                .then(() => matcher.expect([]));
        });

        it(`deleting non-empty directory without recursive flag - fails`, function() {
            return fs.saveFile(`${dirName}/_${dirName}/${fileName}`, content)
                .then(() => matcher.expect([
                    {type: 'directoryCreated', fullPath:dirName},
                    {type: 'directoryCreated', fullPath:`${dirName}/_${dirName}`},
                    {type: 'fileCreated', fullPath:`${dirName}/_${dirName}/${fileName}`, newContent:content}]))
                .then(() => expect(fs.deleteDirectory(`${dirName}/_${dirName}`)).to.be.rejectedWith(Error))
                .then(() => matcher.expect([]));
        });

        it(`deleting non-empty directory with recursive flag`, function() {
            const filePath = `${dirName}/_${dirName}/${fileName}`;
            return fs.saveFile(filePath, content)
                .then(() => matcher.expect([
                    {type: 'directoryCreated', fullPath:dirName},
                    {type: 'directoryCreated', fullPath:`${dirName}/_${dirName}`},
                    {type: 'fileCreated', fullPath:filePath, newContent:content}]))
                .then(() => fs.deleteDirectory(dirName, true))
                .then(() => matcher.expect([
                    {type: 'directoryDeleted', fullPath:dirName},
                    {type: 'fileDeleted', fullPath:filePath}
                ]))
                .then(() => expect(fs.loadDirectoryTree()).to.eventually.have.property('children').eql([]))
                .then(() => matcher.expect([]));
        });

        it(`deleting file which is actually a directory - fails`, function() {
            const dirNameAsFileName = fileName;
            return fs.ensureDirectory(dirNameAsFileName)
                .then(() => matcher.expect([{type: 'directoryCreated', fullPath:dirNameAsFileName}]))
                .then(() => expect(fs.deleteFile(dirNameAsFileName)).to.be.rejectedWith(Error))
                .then(() => matcher.expect([]));
        });

        it(`deleting only one file`, function() {
            return fs.saveFile(fileName, content)
                .then(() => matcher.expect([{type: 'fileCreated', fullPath:fileName, newContent:content}]))
                .then(() => fs.saveFile(`_${fileName}`, `_${content}`))
                .then(() => matcher.expect([{type: 'fileCreated', fullPath:`_${fileName}`, newContent:`_${content}`}]))
                .then(() => fs.deleteFile(`_${fileName}`))
                .then(() => matcher.expect([{type: 'fileDeleted', fullPath:`_${fileName}`}]))
                .then(() => expect(fs.loadDirectoryTree()).to.eventually.have.property('children').eql([{fullPath:fileName, name:fileName, type:'file'}]))
                .then(() => matcher.expect([]));
        });

        it(`deleting non existing file succeeds`, function() {
            return fs.deleteFile(fileName)
                .then(() => expect(fs.loadDirectoryTree()).to.eventually.have.property('children').eql([]))
                .then(() => matcher.expect([]));
        });

        it(`deleting non existing file (deep path) succeeds`, function() {
            return fs.deleteFile(`${dirName}/${fileName}`)
                .then(() => expect(fs.loadDirectoryTree()).to.eventually.have.property('children').eql([]))
                .then(() => matcher.expect([]));
        });

        it(`deleting ignored file succeeds`, function() {
            return fs.deleteFile(ignoredFile)
                .then(() => matcher.expect([]))
                .then(() => expect(fs.loadDirectoryTree()).to.eventually.have.property('children').eql([]));
        });

        it(`deleting ignored directory succeeds`, function() {
            return fs.deleteDirectory(ignoredDir)
                .then(() => matcher.expect([]))
                .then(() => expect(fs.loadDirectoryTree()).to.eventually.have.property('children').eql([]));
        });

        it(`saving ignored file - fails`, function() {
            return expect(fs.saveFile(ignoredFile, 'foo')).to.be.rejectedWith(Error);
        });

        it(`saving ignored dir - fails`, function() {
            return expect(fs.ensureDirectory(ignoredDir)).to.be.rejectedWith(Error);
        });

        it(`loading existed ignored file - fails`, function() {
            return fs.ensureDirectory(dirName)
                .then(() => expect(fs.loadTextFile(ignoredFile)).to.be.rejectedWith(Error));
        });

        it(`loadDirectoryTree on a sub-path`, function() {
            const expected = {fullPath:``, name:'', type:'dir', children:[
                {fullPath:`${dirName}`, name:dirName, type:'dir', children:[
                    {fullPath:`${dirName}/_${dirName}`, name:`_${dirName}`, type:'dir', children:[
                        {fullPath:`${dirName}/_${dirName}/${fileName}`, name:fileName, type:'file'}
                    ]}]}]};

            return fs.saveFile(`${dirName}/_${dirName}/${fileName}`, content)
                .then(() => matcher.expect([
                    {type: 'directoryCreated', fullPath:dirName},
                    {type: 'directoryCreated', fullPath:`${dirName}/_${dirName}`},
                    {type: 'fileCreated', fullPath:`${dirName}/_${dirName}/${fileName}`, newContent:content}]))
                .then(() => expect(fs.loadDirectoryTree()).to.eventually.eql(expected))
                .then(() => expect(fs.loadDirectoryTree(dirName), `loadDirectoryTree('${dirName}')`).to.eventually.eql(expected.children[0]))
                .then(() => expect(fs.loadDirectoryTree(`${dirName}/_${dirName}`), `loadDirectoryTree('${dirName}/_${dirName}')`).to.eventually.eql(expected.children[0].children[0]))

        });

        it(`loadDirectoryTree on an illegal sub-path`, function() {
            return expect(fs.loadDirectoryTree(fileName)).to.be.rejectedWith(Error);
        });
    });
}

