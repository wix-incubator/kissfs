import {expect} from "chai";
import {
    Correlation,
    Directory,
    DirectoryContent,
    FileSystem,
    fileSystemEventNames,
    FileSystemReadSync,
    pathSeparator
} from '../src/universal';
import {EventsMatcher} from './events-matcher';
import {delayedPromise} from "../src/promise-utils";


export const dirName = 'foo';
export const fileName = 'bar.txt';
export const content = 'content';
export const ignoredDir = 'ignored';
export const ignoredFile = `${dirName}${pathSeparator}ignored.txt`;
const testCorrelation = 'test-correlation';
export function assertFileSystemContract(fsProvider: () => Promise<FileSystem>, options: EventsMatcher.Options) {
    describe(`filesystem contract`, () => {
        let fs: FileSystem;
        let matcher: EventsMatcher;
        beforeEach(() => {
            matcher = new EventsMatcher(options);
            return fsProvider()
                .then(newFs => {
                    fs = newFs;
                    matcher.track(fs.events, ...fileSystemEventNames);
                });
        });

        it(`initially empty`, function () {
            return expect(fs.loadDirectoryTree()).to.become({type: 'dir', name: '', fullPath: '', children: []});
        });

        it(`loading a non-existing file - fails`, function () {
            return expect(fs.loadTextFile(fileName)).to.be.rejectedWith(Error);
        });

        it(`loading a directory as a file - fails`, function () {
            return fs.ensureDirectory(dirName)
                .then((correlation) => {
                    return matcher.expect([{type: 'directoryCreated', fullPath: dirName, correlation}])
                })
                .then(() => expect(fs.loadTextFile(dirName)).to.be.rejectedWith(Error))
                .then(() => matcher.expect([]));
            });

            it(`saving an illegal file name - fails`, function () {
                return expect(fs.saveFile('', content)).to.be.rejectedWith(Error)
                .then(() => {
                    return matcher.expect([])
                });
        });

        it(`ensuring existence of directory`, function () {
            const expectedStructure = {
                type: 'dir', name: '', fullPath: '', children: [
                    {type: 'dir', name: dirName, fullPath: dirName, children: []}
                ]
            };
            return fs.ensureDirectory(dirName)
                .then((correlation) => matcher.expect([{type: 'directoryCreated', fullPath: dirName, correlation}]))
                .then(() => expect(fs.loadDirectoryTree()).to.become(expectedStructure))
                .then(() => fs.ensureDirectory(dirName)) //2nd time does nothing
                .then(() => expect(fs.loadDirectoryTree()).to.become(expectedStructure))
                .then(() => matcher.expect([]))
        });

        it(`ensuring existence of directory (supplying correlation)`, function () {
            const expectedStructure = {
                type: 'dir', name: '', fullPath: '', children: [
                    {type: 'dir', name: dirName, fullPath: dirName, children: []}
                ]
            };
            return fs.ensureDirectory(dirName, testCorrelation)
                .then(async (correlation) => {
                    expect(correlation).to.equal(testCorrelation);
                    await matcher.expect([{type: 'directoryCreated', fullPath: dirName, correlation}])
                })
                .then(() => expect(fs.loadDirectoryTree()).to.become(expectedStructure))
                .then(() => fs.ensureDirectory(dirName)) //2nd time does nothing
                .then(() => expect(fs.loadDirectoryTree()).to.become(expectedStructure))
                .then(() => matcher.expect([]));
        });

        it(`saving a file over a directory - fails`, function () {
            return fs.ensureDirectory(dirName)
                .then((correlation) => matcher.expect([{type: 'directoryCreated', fullPath: dirName, correlation}]))
                .then(() => expect(fs.saveFile(dirName, content)).to.be.rejectedWith(Error))
                .then(() => expect(fs.loadDirectoryTree()).to.become({
                    type: 'dir', name: '', fullPath: '', children: [
                        {type: 'dir', name: dirName, fullPath: dirName, children: []}
                    ]
                }))
                .then(() => matcher.expect([]));
        });

        it(`saving a file over a file in its path - fails`, function () {
            const fileNameAsDir = dirName;
            return fs.saveFile(fileNameAsDir, content)
                .then((correlation) => matcher.expect([{type: 'fileCreated', fullPath: fileNameAsDir, newContent: content, correlation}]))
                .then(() => expect(fs.saveFile(`${fileNameAsDir}/${fileName}`, '_${content}')).to.be.rejectedWith(Error))
                .then(() => expect(fs.loadDirectoryTree()).to.become({
                    type: 'dir', name: '', fullPath: '', children: [
                        {type: 'file', name: fileNameAsDir, fullPath: fileNameAsDir}
                    ]
                }))
                .then(() => matcher.expect([]));
        });

        it(`saving a new file (and a new directory to hold it)`, function () {
            return fs.saveFile(`${dirName}/${fileName}`, content)
                .then((correlation) => matcher.expect([{type: 'directoryCreated', fullPath: dirName, correlation}, {
                    type: 'fileCreated',
                    fullPath: `${dirName}/${fileName}`,
                    newContent: content,
                    correlation
                }]))
                .then(() => expect(fs.loadDirectoryTree()).to.become({
                    type: 'dir', name: '', fullPath: '', children: [
                        {
                            type: 'dir', name: dirName, fullPath: dirName, children: [
                            {type: 'file', name: fileName, fullPath: `${dirName}/${fileName}`}]
                        }]
                }))
                .then(() => matcher.expect([]));
        });

        it(`saving a file with different content`, function () {
            const newContent = `_${content}`;
            return fs.saveFile(fileName, content)
                .then((correlation) => matcher.expect([{type: 'fileCreated', fullPath: fileName, newContent: content, correlation}]))
                .then(() => expect(fs.loadTextFile(fileName)).to.become(content))
                .then(() => fs.saveFile(fileName, newContent))
                .then((correlation) => matcher.expect([{type: 'fileChanged', fullPath: fileName, newContent: newContent, correlation}]))
                .then(() => expect(fs.loadTextFile(fileName)).to.become(newContent))
                .then(() => matcher.expect([]));
        });


        it(`saving a file with different content (supplying correlation)`, function () {
            const newContent = `_${content}`;
            return fs.saveFile(fileName, content)
                .then((correlation) => matcher.expect([{type: 'fileCreated', fullPath: fileName, newContent: content, correlation}]))
                .then(() => expect(fs.loadTextFile(fileName)).to.become(content))
                .then(() => fs.saveFile(fileName, newContent, testCorrelation))
                .then((correlation) => {
                    expect(correlation).to.equal(testCorrelation);
                    return matcher.expect([{type: 'fileChanged', fullPath: fileName, newContent: newContent, correlation}])
                })
                .then(() => expect(fs.loadTextFile(fileName)).to.become(newContent))
                .then(() => matcher.expect([]));
        });

        it(`saving a file with same content`, function () {
            const expectedStructure = {
                type: 'dir', name: '', fullPath: '', children: [
                    {name: fileName, fullPath: fileName, type: 'file'}
                ]
            };

            return fs.saveFile(fileName, content)
                .then((correlation) => matcher.expect([{type: 'fileCreated', fullPath: fileName, newContent: content, correlation}]))
                .then(() => expect(fs.loadTextFile(fileName)).to.become(content))
                .then(() => fs.saveFile(fileName, content)) // may or may not trigger an event
                .then(() => expect(fs.loadDirectoryTree()).to.become(expectedStructure))
                .then(() => expect(fs.loadTextFile(fileName)).to.become(content));
        });

        it(`deleting root directory - fails`, function () {
            return expect(fs.deleteDirectory('')).to.be.rejectedWith(Error)
                .then(() => matcher.expect([]));
        });

        it(`deleting a directory`, function () {
            return fs.ensureDirectory(`${dirName}/_${dirName}`)
                .then(async (correlation) =>{
                     fs;
                     await matcher.expect([
                        {type: 'directoryCreated', fullPath: dirName, correlation},
                        {type: 'directoryCreated', fullPath: `${dirName}/_${dirName}`, correlation}
                    ])
                })
                .then(() => fs.deleteDirectory(`${dirName}/_${dirName}`))
                .then(async (correlation) => {
                    await matcher.expect([{type: 'directoryDeleted', fullPath: `${dirName}/_${dirName}`, correlation}])
                })
                .then(() => expect(fs.loadDirectoryTree()).to.eventually.have.property('children').eql([
                    {children: [], fullPath: dirName, name: dirName, type: 'dir'}]))
                .then(() => matcher.expect([]));
        });


        it(`deleting a directory (supplying correlation)`, function () {
            return fs.ensureDirectory(`${dirName}/_${dirName}`)
                .then((correlation) => matcher.expect([
                    {type: 'directoryCreated', fullPath: dirName, correlation},
                    {type: 'directoryCreated', fullPath: `${dirName}/_${dirName}`, correlation}]))
                .then(() => fs.deleteDirectory(`${dirName}/_${dirName}`, false, testCorrelation))
                .then((correlation) => {
                    expect(correlation).to.equal(testCorrelation);
                    return matcher.expect([{type: 'directoryDeleted', fullPath: `${dirName}/_${dirName}`, correlation}])
                })
                .then(() => expect(fs.loadDirectoryTree()).to.eventually.have.property('children').eql([
                    {children: [], fullPath: dirName, name: dirName, type: 'dir'}]))
                .then(() => matcher.expect([]));
        });

        it(`deleting non existing directory succeeds`, function () {
            return fs.deleteDirectory(`${dirName}/_${dirName}`)
                .then(() => expect(fs.loadDirectoryTree()).to.eventually.have.property('children').eql([]))
                .then(() => matcher.expect([]));
        });

        it(`deleting directory which is actually a file - fails`, function () {
            return fs.saveFile(fileName, content)
                .then((correlation) => matcher.expect([{type: 'fileCreated', fullPath: fileName, newContent: content, correlation}]))
                .then(() => expect(fs.deleteDirectory(fileName)).to.be.rejectedWith(Error))
                .then(() => matcher.expect([]));
        });

        it(`deleting non-empty directory without recursive flag - fails`, function () {
            return fs.saveFile(`${dirName}/_${dirName}/${fileName}`, content)
                .then((correlation) => matcher.expect([
                    {type: 'directoryCreated', fullPath: dirName, correlation},
                    {type: 'directoryCreated', fullPath: `${dirName}/_${dirName}`, correlation},
                    {type: 'fileCreated', fullPath: `${dirName}/_${dirName}/${fileName}`, newContent: content, correlation}]))
                .then(() => expect(fs.deleteDirectory(`${dirName}/_${dirName}`)).to.be.rejectedWith(Error))
                .then(() => matcher.expect([]));
        });

        it(`deleting non-empty directory with recursive flag`, function () {
            const filePath = `${dirName}/_${dirName}/${fileName}`;
            return fs.saveFile(filePath, content)
                .then((correlation) => matcher.expect([
                    {type: 'directoryCreated', fullPath: dirName, correlation},
                    {type: 'directoryCreated', fullPath: `${dirName}/_${dirName}`, correlation},
                    {type: 'fileCreated', fullPath: filePath, newContent: content, correlation}]))
                .then(() => fs.deleteDirectory(dirName, true))
                .then((correlation) => matcher.expect([
                    {type: 'directoryDeleted', fullPath: dirName, correlation},
                    {type: 'fileDeleted', fullPath: filePath, correlation}
                ]))
                .then(() => expect(fs.loadDirectoryTree()).to.eventually.have.property('children').eql([]))
                .then(() => matcher.expect([]));
        });

        it(`deleting file which is actually a directory - fails`, function () {
            const dirNameAsFileName = fileName;
            return fs.ensureDirectory(dirNameAsFileName)
                .then((correlation) => matcher.expect([{type: 'directoryCreated', fullPath: dirNameAsFileName, correlation}]))
                .then(() => expect(fs.deleteFile(dirNameAsFileName)).to.be.rejectedWith(Error))
                .then(() => matcher.expect([]));
        });

        it(`deleting only one file`, function () {
            return fs.saveFile(fileName, content)
                .then((correlation) => matcher.expect([{type: 'fileCreated', fullPath: fileName, newContent: content, correlation}]))
                .then(() => fs.saveFile(`_${fileName}`, `_${content}`))
                .then((correlation) => matcher.expect([{
                    type: 'fileCreated',
                    fullPath: `_${fileName}`,
                    newContent: `_${content}`,
                    correlation
                }]))
                .then(() => fs.deleteFile(`_${fileName}`))
                .then((correlation) => matcher.expect([{type: 'fileDeleted', fullPath: `_${fileName}`, correlation}]))
                .then(() => expect(fs.loadDirectoryTree()).to.eventually.have.property('children').eql([{
                    fullPath: fileName,
                    name: fileName,
                    type: 'file'
                }]))
                .then(() => matcher.expect([]));
        });

        it(`deleting non existing file succeeds`, function () {
            return fs.deleteFile(fileName)
                .then(() => expect(fs.loadDirectoryTree()).to.eventually.have.property('children').eql([]))
                .then(() => matcher.expect([]));
        });

        it(`deleting non existing file (deep path) succeeds`, function () {
            return fs.deleteFile(`${dirName}/${fileName}`)
                .then(() => expect(fs.loadDirectoryTree()).to.eventually.have.property('children').eql([]))
                .then(() => matcher.expect([]));
        });

        it(`deleting ignored file succeeds`, function () {
            return fs.deleteFile(ignoredFile)
                .then(() => matcher.expect([]))
                .then(() => expect(fs.loadDirectoryTree()).to.eventually.have.property('children').eql([]));
        });

        it(`deleting ignored directory succeeds`, function () {
            return fs.deleteDirectory(ignoredDir)
                .then(() => matcher.expect([]))
                .then(() => expect(fs.loadDirectoryTree()).to.eventually.have.property('children').eql([]));
        });

        it(`saving ignored file - fails`, function () {
            return expect(fs.saveFile(ignoredFile, 'foo')).to.be.rejectedWith(Error);
        });

        it(`saving ignored dir - fails`, function () {
            return expect(fs.ensureDirectory(ignoredDir)).to.be.rejectedWith(Error);
        });

        it(`loading existed ignored file - fails`, function () {
            return fs.ensureDirectory(dirName)
                .then(() => expect(fs.loadTextFile(ignoredFile)).to.be.rejectedWith(Error));
        });

        it(`loadDirectoryTree`, function () {
            const expected = {
                fullPath: ``, name: '', type: 'dir', children: [
                    {
                        fullPath: `${dirName}`, name: dirName, type: 'dir', children: [
                        {
                            fullPath: `${dirName}/_${dirName}`, name: `_${dirName}`, type: 'dir', children: [
                            {fullPath: `${dirName}/_${dirName}/${fileName}`, name: fileName, type: 'file'}
                        ]
                        }]
                    }]
            };

            return fs.saveFile(`${dirName}/_${dirName}/${fileName}`, content)
                .then(() => expect(fs.loadDirectoryTree()).to.eventually.eql(expected))
                .then(() => expect(fs.loadDirectoryTree(dirName), `loadDirectoryTree('${dirName}')`).to.eventually.eql(expected.children[0]))
                .then(() => expect(fs.loadDirectoryTree(`${dirName}/_${dirName}`), `loadDirectoryTree('${dirName}/_${dirName}')`).to.eventually.eql(expected.children[0].children[0]))

        });

        it(`loadDirectoryTree on an illegal sub-path`, function () {
            return expect(fs.loadDirectoryTree(fileName)).to.be.rejectedWith(Error);
        });

        it(`loadDirectoryChildren`, function () {
            return fs.saveFile(`${dirName}/_${dirName}/${fileName}`, content)
                .then(() => fs.saveFile(`${fileName}`, content))
                .then(() => expect(fs.loadDirectoryChildren('')).to.eventually.have.deep.members([
                    {fullPath: `${dirName}`, name: dirName, type: 'dir'},
                    {fullPath: fileName, name: fileName, type: 'file'}
                ]))
                .then(() => expect(fs.loadDirectoryChildren(dirName), `loadDirectoryChildren('${dirName}')`).to.eventually.have.deep.members(
                    [{fullPath: `${dirName}/_${dirName}`, name: `_${dirName}`, type: 'dir'}]))
                .then(() => expect(fs.loadDirectoryChildren(`${dirName}/_${dirName}`), `loadDirectoryChildren('${dirName}/_${dirName}')`).to.eventually.have.deep.members(
                    [{fullPath: `${dirName}/_${dirName}/${fileName}`, name: fileName, type: 'file'}]));
        });

        it(`loadDirectoryChildren on an illegal sub-path`, function () {
            return expect(fs.loadDirectoryChildren(fileName)).to.be.rejectedWith(Error);
        });

        describe(`action-event correlation`, function () {
            it(`single event per action`, async function () {
                this.timeout(30 * 1000);
                let allCorelations: Set<Correlation> = new Set();
                let correlation = await fs.saveFile(fileName, 'foo');
                expect(correlation).to.be.a('string');
                allCorelations.add(correlation);
                expect(allCorelations.size).to.eql(1);
                await matcher.expect([{type: 'fileCreated', fullPath: fileName, correlation}]);
                await delayedPromise(100);
                correlation = await fs.saveFile(fileName, 'bar');
                expect(correlation).to.be.a('string');
                allCorelations.add(correlation);
                expect(allCorelations.size).to.eql(2);
                await matcher.expect([{type: 'fileChanged', fullPath: fileName, correlation}]);
                await delayedPromise(100);
                correlation = await fs.deleteFile(fileName);
                expect(correlation).to.be.a('string');
                allCorelations.add(correlation);
                expect(allCorelations.size).to.eql(3);
                await matcher.expect([{type: 'fileDeleted', fullPath: fileName, correlation}]);
                await delayedPromise(100);
                correlation = await fs.ensureDirectory(dirName);
                expect(correlation).to.be.a('string');
                allCorelations.add(correlation);
                expect(allCorelations.size).to.eql(4);
                await matcher.expect([{type: 'directoryCreated', fullPath: dirName, correlation}]);
                await delayedPromise(100);
                correlation = await fs.deleteDirectory(dirName);
                expect(correlation).to.be.a('string');
                allCorelations.add(correlation);
                expect(allCorelations.size).to.eql(5);
                await matcher.expect([{type: 'directoryDeleted', fullPath: dirName, correlation}]);
            });

            it(`multiple events per action`, async function () {
                this.timeout(10 * 1000);
                let correlation = await fs.saveFile(`${dirName}/${fileName}`, content);
                expect(correlation).to.be.a('string');
                await matcher.expect([
                    {type: 'directoryCreated', fullPath: dirName, correlation},
                    {
                        type: 'fileCreated',
                        fullPath: `${dirName}/${fileName}`,
                        newContent: content,
                        correlation
                    }]);
                correlation = await fs.deleteDirectory(dirName, true);
                await matcher.expect([
                    {type: 'directoryDeleted', fullPath: dirName, correlation},
                    {
                        type: 'fileDeleted',
                        fullPath: `${dirName}/${fileName}`,
                        correlation
                    }]);
            });
        });
    });
}

export function assertFileSystemSyncContract(fsProvider: () => Promise<FileSystemReadSync>, options: EventsMatcher.Options) {
    let fs: FileSystemReadSync;
    let matcher: EventsMatcher;
    beforeEach(() => {
        matcher = new EventsMatcher(options);
        return fsProvider()
            .then(newFs => {
                fs = newFs;
                matcher.track(fs.events, ...fileSystemEventNames);
            });
    });

    describe(`filesystem sync contract`, () => {
        let fs: FileSystemReadSync;
        let matcher: EventsMatcher;
        beforeEach(() => {
            matcher = new EventsMatcher(options);
            return fsProvider()
                .then(newFs => {
                    fs = newFs;
                    matcher.track(fs.events, ...fileSystemEventNames);
                });
        });


        it(`loading a non-existing file - fails`, function () {
            return expect(() => fs.loadTextFileSync(fileName)).to.throw(Error);
        });

        it(`loading a directory as a file - fails`, function () {
            return fs.ensureDirectory(dirName)
                .then((correlation) => {
                    return matcher.expect([{type: 'directoryCreated', fullPath: dirName, correlation}])
                })
                .then(() => expect(() => fs.loadTextFileSync(dirName)).to.throw(Error))
                .then(() => matcher.expect([]));
        });

        it(`loading existed ignored file - fails`, function () {
            return fs.ensureDirectory(dirName)
                .then(() => expect(() => fs.loadTextFileSync(ignoredFile)).to.throw(Error));
        });

        it(`loadDirectoryTreeSync`, function () {
            const expected = {
                fullPath: ``, name: '', type: 'dir', children: [
                    {
                        fullPath: `${dirName}`, name: dirName, type: 'dir', children: [
                        {
                            fullPath: `${dirName}/_${dirName}`, name: `_${dirName}`, type: 'dir', children: [
                            {fullPath: `${dirName}/_${dirName}/${fileName}`, name: fileName, type: 'file'}
                        ]
                        }]
                    }]
            };

            return fs.saveFile(`${dirName}/_${dirName}/${fileName}`, content)
                .then(() => {
                    expect(fs.loadDirectoryTreeSync()).to.eql(expected);
                    expect(fs.loadDirectoryTreeSync(dirName), `loadDirectoryTreeSync('${dirName}')`).to.eql(expected.children[0])
                    expect(fs.loadDirectoryTreeSync(`${dirName}/_${dirName}`), `loadDirectoryTreeSync('${dirName}/_${dirName}')`).to.eql(expected.children[0].children[0])
                })

        });

        it(`loadDirectoryTreeSync on an illegal sub-path`, function () {
            return expect(() => fs.loadDirectoryTreeSync(fileName)).to.throw(Error);
        });

        it(`loadDirectoryChildrenSync`, function () {
            return fs.saveFile(`${dirName}/_${dirName}/${fileName}`, content)
                .then(() => fs.saveFile(`${fileName}`, content))
                .then(() => {
                    expect(fs.loadDirectoryChildrenSync('')).to.have.deep.members([
                        {fullPath: `${dirName}`, name: dirName, type: 'dir'},
                        {fullPath: fileName, name: fileName, type: 'file'}
                    ]);
                    expect(fs.loadDirectoryChildrenSync(dirName), `loadDirectoryChildrenSync('${dirName}')`).to.have.deep.members(
                        [{fullPath: `${dirName}/_${dirName}`, name: `_${dirName}`, type: 'dir'}]);
                    expect(fs.loadDirectoryChildrenSync(`${dirName}/_${dirName}`), `loadDirectoryChildrenSync('${dirName}/_${dirName}')`).to.have.deep.members(
                        [{fullPath: `${dirName}/_${dirName}/${fileName}`, name: fileName, type: 'file'}])
                })
        });

        it(`loadDirectoryChildrenSync on an illegal sub-path`, function () {
            return expect(() => fs.loadDirectoryChildrenSync(fileName)).to.throw(Error);
        });

        it(`loadDirectoryContentSync`, function () {
            const expected = Directory.toContent({
                fullPath: ``, name: '', type: 'dir', children: [
                    {
                        fullPath: `${dirName}`, name: dirName, type: 'dir', children: [
                        {
                            fullPath: `${dirName}/_${dirName}`, name: `_${dirName}`, type: 'dir', children: [
                            {fullPath: `${dirName}/_${dirName}/${fileName}`, name: fileName, type: 'file', content}
                        ]
                        }]
                    }]
            });

            return fs.saveFile(`${dirName}/_${dirName}/${fileName}`, content)
                .then(() => {
                    expect(fs.loadDirectoryContentSync()).to.eql(expected);
                    expect(fs.loadDirectoryContentSync(dirName), `loadDirectoryContentSync('${dirName}')`).to.eql(expected[dirName]);
                    expect(fs.loadDirectoryContentSync(`${dirName}/_${dirName}`), `loadDirectoryContentSync('${dirName}/_${dirName}')`).to.eql((expected[dirName] as DirectoryContent)['_' + dirName]);
                })

        });

        it(`loadDirectoryTreeSync on an illegal sub-path`, function () {
            return expect(() => fs.loadDirectoryTreeSync(fileName)).to.throw(Error);
        });
    });
}
