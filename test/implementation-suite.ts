import {expect} from "chai";
import { fileSystemEventNames, pathSeparator} from '../src/universal';
import {EventsMatcher} from '../test-kit/drivers/events-matcher';
import {EventEmitter} from 'eventemitter3';
import { FileSystemSync, Directory, ShallowDirectory, File } from '../src/api';
import {  Thenable } from 'when';
import { Error } from 'autobahn';


export const dirName = 'foo';
export const fileName = 'bar.txt';
export const content = 'content';
export const ignoredDir = 'ignored';
export const ignoredFile = `${dirName}${pathSeparator}ignored.txt`;





export type IsAsync = 'sync' | 'async';

export type SyncAsyncValueRes<T> = {
    'sync':T;
    'async':Promise<T>;
}
export interface SuiteTestedApi<isAsync extends IsAsync>{
    saveFile(fullPath:string, newContent:string): SyncAsyncValueRes<void>[isAsync];
    deleteFile(fullPath:string):SyncAsyncValueRes<void>[isAsync];
    deleteDirectory(fullPath:string, recursive?:boolean):SyncAsyncValueRes<void>[isAsync];
    loadTextFile(fullPath:string): SyncAsyncValueRes<string>[isAsync];
    loadDirectoryTree(fullPath?:string): SyncAsyncValueRes<Directory>[isAsync];
    loadDirectoryChildren(fullPath:string): SyncAsyncValueRes<(File | ShallowDirectory)[]>[isAsync];
    ensureDirectory(fullPath:string): SyncAsyncValueRes<void>[isAsync];
    readonly events:EventEmitter;
    readonly baseUrl: string;
    readonly isSync ?: 'sync'
}

function getIsAsync(api:SuiteTestedApi<IsAsync>):IsAsync{
    return api.isSync ? 'sync' : 'async'
}

export class SyncAdaptor implements SuiteTestedApi<'sync'>{
    constructor(private fs:FileSystemSync){}
    saveFile(fullPath:string, newContent:string){
        return this.fs.saveFileSync(fullPath,newContent);
    }
    deleteFile(fullPath:string){
        //TODO: change to deleteFileSync
        this.fs.deleteFile(fullPath)
    }
    deleteDirectory(fullPath:string, recursive?:boolean){
        //TODO: change to deleteDirectorySync
        this.fs.deleteDirectory(fullPath, recursive);
    }
    loadTextFile(fullPath:string){
        return this.fs.loadTextFileSync(fullPath);
    }
    loadDirectoryTree(fullPath?:string){
        //TODO: change to loadDirectoryTreeSync
        return new Directory('dummy',fullPath || '')
        // return this.fs.loadDirectoryTreeSync(fullPath);
    }
    loadDirectoryChildren(fullPath:string){
        //TODO: change to loadDirectoryTreeSync
        fullPath;
        return []
        // return this.fs.loadDirectoryChildren(fullPath);
    }
    ensureDirectory(fullPath:string){
        return this.fs.ensureDirectorySync(fullPath);
    }
    get events():EventEmitter{
        return this.fs.events as any as EventEmitter;
    };
    get baseUrl(): string{
        return this.fs.baseUrl;
    }
}

function expectRes(actual:any, expected:any,isAsync:IsAsync){
    if(isAsync==='sync'){
        expect(actual).to.equal(expected);
    }else{
        expect(actual).to.become(expected);
    }
}

function expectReject(call:Function,rejectedWith:typeof Error,isAsync:IsAsync){
    if(isAsync==='sync'){
        expect(call).to.throw(rejectedWith);
    }else{
        expect(call).to.be.rejectedWith(rejectedWith);
    }
}

function PromiseLike<isPromise extends IsAsync,Res>(call:()=>SyncAsyncValueRes<Res>[isPromise],isAsync:isPromise):Thenable<Res>{
    if(isAsync==='sync'){
        let res:Res
        return {
            then:( resolve:(res:Res)=>any, reject:(rejectedWith:any)=>any)=>{
                try{
                   res = call() as Res; 
                }catch(error){
                   reject(error);
                }
                return PromiseLike(()=>resolve(res),isAsync);
            }
            
        }
    }else{
        return call() as Promise<Res>;
    }
}

export function assertFileSystemContract<isAsync extends IsAsync>(fsProvider: () => Promise<SuiteTestedApi<isAsync>>, options:EventsMatcher.Options) {
    describe(`filesystem contract`, () => {
        let fs: SuiteTestedApi<isAsync>;
        let matcher: EventsMatcher;
        let isAsync:isAsync;
        beforeEach(() => {
            matcher = new EventsMatcher(options);
            return fsProvider()
                .then(newFs => {
                    fs = newFs;
                    isAsync = getIsAsync(fs) as isAsync;
                    matcher.track(fs.events as any as EventEmitter, ...fileSystemEventNames);
                });
        });

        it(`initially empty`, function() {
            return expectRes(fs.loadDirectoryTree(),{type:'dir', name:'', fullPath:'', children:[]},isAsync);
        });

        it(`loading a non-existing file - fails`, function() {
            return expectReject(()=>fs.loadTextFile(fileName),Error,isAsync)
        });

        it(`loading a directory as a file - fails`, function() {
            return PromiseLike<isAsync, void>(()=>fs.ensureDirectory(dirName),isAsync)
            .then(() => {
                return matcher.expect([{type: 'directoryCreated', fullPath:dirName}])
            })
            .then(() => expect(fs.loadTextFile(dirName)).to.be.rejectedWith(Error))
            .then(() => matcher.expect([]));
        });

        it(`saving an illegal file name - fails`, function() {
            return PromiseLike<isAsync,void>(()=>{
                expectReject(()=>fs.saveFile('', content),Error,isAsync)
            },isAsync)
            .then(() => matcher.expect([]));
        });

        it(`ensuring existence of directory`, function() {
            const expectedStructure = {
                type:'dir', name:'', fullPath:'', children:[
                    {type:'dir', name:dirName, fullPath:dirName, children:[]}
                ]};
            return PromiseLike<isAsync, void>(()=>fs.ensureDirectory(dirName),isAsync)
                .then(() => matcher.expect([{type: 'directoryCreated', fullPath:dirName}]))
                .then(() => expect(fs.loadDirectoryTree()).to.become(expectedStructure))
                .then(() => fs.ensureDirectory(dirName)) //2nd time does nothing
                .then(() => expect(fs.loadDirectoryTree()).to.become(expectedStructure))
                .then(() => matcher.expect([]))
        });

        it(`saving a file over a directory - fails`, function() {
            return PromiseLike<isAsync, void>(()=>fs.ensureDirectory(dirName),isAsync)
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
            return PromiseLike<isAsync, void>(()=>fs.saveFile(fileNameAsDir, content),isAsync)
                .then(() => matcher.expect([{type: 'fileCreated', fullPath:fileNameAsDir, newContent:content}]))
                .then(() => expect(fs.saveFile(`${fileNameAsDir}/${fileName}`, '_${content}')).to.be.rejectedWith(Error))
                .then(() => expect(fs.loadDirectoryTree()).to.become({
                    type:'dir', name:'', fullPath:'', children:[
                        {type:'file', name:fileNameAsDir, fullPath:fileNameAsDir}
                    ]}))
                .then(() => matcher.expect([]));
        });

        it(`saving a new file (and a new directory to hold it)`, function() {
            return PromiseLike<isAsync, void>(()=>fs.saveFile(`${dirName}/${fileName}`, content),isAsync)
                .then(() => matcher.expect([{type: 'directoryCreated', fullPath:dirName}, {type: 'fileCreated', fullPath:`${dirName}/${fileName}`, newContent:content}]))
                .then(() => expect(fs.loadDirectoryTree()).to.become({
                    type:'dir', name:'', fullPath:'', children:[
                        {type:'dir', name:dirName, fullPath:dirName, children:[
                            {type:'file', name:fileName, fullPath:`${dirName}/${fileName}`}]}]}))
                .then(() => matcher.expect([]));
        });

        it(`saving a file with different content`, function() {
            const newContent = `_${content}`;
            return PromiseLike<isAsync, void>(()=>fs.saveFile(fileName, content),isAsync)
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

            return PromiseLike<isAsync, void>(()=>fs.saveFile(fileName, content),isAsync)
                .then(() => matcher.expect([{type: 'fileCreated', fullPath:fileName, newContent:content}]))
                .then(() => expect(fs.loadTextFile(fileName)).to.become(content))
                .then(() => fs.saveFile(fileName, content)) // may or may not trigger an event
                .then(() => expect(fs.loadDirectoryTree()).to.become(expectedStructure))
                .then(() => expect(fs.loadTextFile(fileName)).to.become(content));
        });

        it(`deleting root directory - fails`, function() {
            return PromiseLike<isAsync, void>(()=>expectReject(()=>fs.deleteDirectory(''),Error,isAsync),isAsync)
                .then(() => matcher.expect([]));
        });

        it(`deleting a directory`, function() {
            return PromiseLike<isAsync, void>(()=>fs.ensureDirectory(`${dirName}/_${dirName}`),isAsync)
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
            return PromiseLike<isAsync, void>(()=>fs.deleteDirectory(`${dirName}/_${dirName}`),isAsync)
                .then(() => expect(fs.loadDirectoryTree()).to.eventually.have.property('children').eql([]))
                .then(() => matcher.expect([]));
        });

        it(`deleting directory which is actually a file - fails`, function() {
            return PromiseLike<isAsync, void>(()=>fs.saveFile(fileName, content),isAsync)
                .then(() => matcher.expect([{type: 'fileCreated', fullPath:fileName, newContent:content}]))
                .then(() => expect(fs.deleteDirectory(fileName)).to.be.rejectedWith(Error))
                .then(() => matcher.expect([]));
        });

        it(`deleting non-empty directory without recursive flag - fails`, function() {
            return PromiseLike<isAsync, void>(()=>fs.saveFile(`${dirName}/_${dirName}/${fileName}`, content),isAsync)
                .then(() => matcher.expect([
                    {type: 'directoryCreated', fullPath:dirName},
                    {type: 'directoryCreated', fullPath:`${dirName}/_${dirName}`},
                    {type: 'fileCreated', fullPath:`${dirName}/_${dirName}/${fileName}`, newContent:content}]))
                .then(() => expect(fs.deleteDirectory(`${dirName}/_${dirName}`)).to.be.rejectedWith(Error))
                .then(() => matcher.expect([]));
        });

        it(`deleting non-empty directory with recursive flag`, function() {
            const filePath = `${dirName}/_${dirName}/${fileName}`;
            return PromiseLike<isAsync, void>(()=>fs.saveFile(filePath, content),isAsync)
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
            return PromiseLike<isAsync, void>(()=>fs.ensureDirectory(dirNameAsFileName),isAsync)
                .then(() => matcher.expect([{type: 'directoryCreated', fullPath:dirNameAsFileName}]))
                .then(() => expect(fs.deleteFile(dirNameAsFileName)).to.be.rejectedWith(Error))
                .then(() => matcher.expect([]));
        });

        it(`deleting only one file`, function() {
            return PromiseLike<isAsync, void>(()=>fs.saveFile(fileName, content),isAsync)
                .then(() => matcher.expect([{type: 'fileCreated', fullPath:fileName, newContent:content}]))
                .then(() => fs.saveFile(`_${fileName}`, `_${content}`))
                .then(() => matcher.expect([{type: 'fileCreated', fullPath:`_${fileName}`, newContent:`_${content}`}]))
                .then(() => fs.deleteFile(`_${fileName}`))
                .then(() => matcher.expect([{type: 'fileDeleted', fullPath:`_${fileName}`}]))
                .then(() => expect(fs.loadDirectoryTree()).to.eventually.have.property('children').eql([{fullPath:fileName, name:fileName, type:'file'}]))
                .then(() => matcher.expect([]));
        });

        it(`deleting non existing file succeeds`, function() {
            return PromiseLike<isAsync, void>(()=>fs.deleteFile(fileName),isAsync)
                .then(() => expect(fs.loadDirectoryTree()).to.eventually.have.property('children').eql([]))
                .then(() => matcher.expect([]));
        });

        it(`deleting non existing file (deep path) succeeds`, function() {
            return PromiseLike<isAsync, void>(()=>fs.deleteFile(`${dirName}/${fileName}`),isAsync)
                .then(() => expect(fs.loadDirectoryTree()).to.eventually.have.property('children').eql([]))
                .then(() => matcher.expect([]));
        });

        it(`deleting ignored file succeeds`, function() {
            return PromiseLike<isAsync, void>(()=>fs.deleteFile(ignoredFile),isAsync)
                .then(() => matcher.expect([]))
                .then(() => expect(fs.loadDirectoryTree()).to.eventually.have.property('children').eql([]));
        });

        it(`deleting ignored directory succeeds`, function() {
            return PromiseLike<isAsync, void>(()=>fs.deleteDirectory(ignoredDir),isAsync)
                .then(() => matcher.expect([]))
                .then(() => expect(fs.loadDirectoryTree()).to.eventually.have.property('children').eql([]));
        });

        it(`saving ignored file - fails`, function() {
            return expectReject(()=>fs.saveFile(ignoredFile, 'foo'),Error,isAsync);
        });

        it(`saving ignored dir - fails`, function() {
            return expectReject(()=>fs.ensureDirectory(ignoredDir),Error,isAsync);
        });

        it(`loading existed ignored file - fails`, function() {
            return PromiseLike<isAsync, void>(()=>fs.ensureDirectory(dirName),isAsync)
                .then(() => expectReject(()=>fs.loadTextFile(ignoredFile),Error,isAsync));
        });

        it(`loadDirectoryTree`, function() {
            const expected = {fullPath:``, name:'', type:'dir', children:[
                {fullPath:`${dirName}`, name:dirName, type:'dir', children:[
                    {fullPath:`${dirName}/_${dirName}`, name:`_${dirName}`, type:'dir', children:[
                        {fullPath:`${dirName}/_${dirName}/${fileName}`, name:fileName, type:'file'}
                    ]}]}]};

            return  PromiseLike<isAsync, void>(()=>fs.saveFile(`${dirName}/_${dirName}/${fileName}`, content),isAsync)
                .then(() => expect(fs.loadDirectoryTree()).to.eventually.eql(expected))
                .then(() => expect(fs.loadDirectoryTree(dirName), `loadDirectoryTree('${dirName}')`).to.eventually.eql(expected.children[0]))
                .then(() => expect(fs.loadDirectoryTree(`${dirName}/_${dirName}`), `loadDirectoryTree('${dirName}/_${dirName}')`).to.eventually.eql(expected.children[0].children[0]))

        });

        it(`loadDirectoryTree on an illegal sub-path`, function() {
            return expectReject(()=>fs.loadDirectoryTree(fileName),Error,isAsync);
        });

        it(`loadDirectoryChildren`, function() {
            return PromiseLike<isAsync, void>(()=>fs.saveFile(`${dirName}/_${dirName}/${fileName}`, content),isAsync)
                .then(()=> fs.saveFile(`${fileName}`, content))
                .then(() => expect(fs.loadDirectoryChildren('')).to.eventually.have.deep.members([
                    {fullPath:`${dirName}`, name:dirName, type:'dir'},
                    {fullPath:fileName, name:fileName, type:'file'}
                    ]))
                .then(() => expect(fs.loadDirectoryChildren(dirName), `loadDirectoryChildren('${dirName}')`).to.eventually.have.deep.members(
                    [{fullPath:`${dirName}/_${dirName}`, name:`_${dirName}`, type:'dir'}]))
                .then(() => expect(fs.loadDirectoryChildren(`${dirName}/_${dirName}`), `loadDirectoryChildren('${dirName}/_${dirName}')`).to.eventually.have.deep.members(
                    [{fullPath:`${dirName}/_${dirName}/${fileName}`, name:fileName, type:'file'}]));
        });

        it(`loadDirectoryChildren on an illegal sub-path`, function() {
            return expectReject(()=>fs.loadDirectoryChildren(fileName),Error,isAsync);
        });
    });


    
}
export function assertFileSystemSyncContract(fsProvider: () => Promise<FileSystemSync>, options:EventsMatcher.Options){
    fsProvider
    options
    // describe.only("FileSystem sync operations",()=>{
    //     let fs: FileSystemSync;
    //     let matcher: EventsMatcher;
    //     beforeEach(() => {
    //         matcher = new EventsMatcher(options);
    //         return fsProvider()
    //         .then(newFs => {
    //                 fs = newFs;
    //                 matcher.track(fs.events as any as EventEmitter, ...fileSystemEventNames);
    //         });
    //     });
            
    //     it(`loading a non-existing file - throws an error`, function() {
    //         return expect(()=>fs.loadTextFileSync(fileName)).to.be.throw(Error);
    //     });

    //     it(`loading a directory as a file - fails`, function() {
    //         return fs.ensureDirectory(dirName)
    //             .then(() => {
    //                 return matcher.expect([{type: 'directoryCreated', fullPath:dirName}])
    //             })
    //             .then(() => expect(()=>fs.loadTextFileSync(dirName)).to.throw(Error))
    //             .then(() => matcher.expect([]));
    //     });

    //     it(`saving an illegal file name - fails`, function() {
    //         expect(()=>fs.saveFileSync('', content)).to.throw(Error)
    //         matcher.expect([]);
    //     });

    //     it(`ensuring existence of directory`, function() {
    //         const expectedStructure = {
    //             type:'dir', name:'', fullPath:'', children:[
    //                 {type:'dir', name:dirName, fullPath:dirName, children:[]}
    //             ]};
    //         fs.ensureDirectorySync(dirName)

    //         matcher.expect([{type: 'directoryCreated', fullPath:dirName}])
    //         .then(() => expect(fs.loadDirectoryTree()).to.become(expectedStructure))
    //         .then(() => {
    //             fs.ensureDirectorySync(dirName)
    //             return expect(fs.loadDirectoryTree()).to.become(expectedStructure)
    //         }) //2nd time does nothing
    //         .then(() => matcher.expect([]))
    //     });

    //     it(`saving a file over a directory - fails`, function() {
    //         fs.ensureDirectorySync(dirName)
           
    //         expect(()=> fs.saveFileSync(dirName, content)).to.throw(Error)
    //         return expect(fs.loadDirectoryTree()).to.become({
    //             type:'dir', name:'', fullPath:'', children:[
    //             {type:'dir', name:dirName, fullPath:dirName, children:[]}
    //         ]})
    //     });


    //     it(`saving a file over a file in its path - fails`, function() {
    //         const fileNameAsDir = dirName;
    //         fs.saveFileSync(fileNameAsDir, content)
    //         matcher.expect([{type: 'fileCreated', fullPath:fileNameAsDir, newContent:content}]);

    //         expect(()=>fs.saveFileSync(`${fileNameAsDir}/${fileName}`, '_${content}')).to.throw(Error);

    //         return expect(fs.loadDirectoryTree()).to.become({
    //                 type:'dir', name:'', fullPath:'', children:[
    //                     {type:'file', name:fileNameAsDir, fullPath:fileNameAsDir}
    //                 ]})
    //             .then(() => matcher.expect([]));
    //     });

    //     it(`saving a new file (and a new directory to hold it)`, function() {
    //         fs.saveFileSync(`${dirName}/${fileName}`, content)

    //         matcher.expect([{type: 'directoryCreated', fullPath:dirName}, {type: 'fileCreated', fullPath:`${dirName}/${fileName}`, newContent:content}]);

    //         return expect(fs.loadDirectoryTree()).to.become({
    //                 type:'dir', name:'', fullPath:'', children:[
    //                     {type:'dir', name:dirName, fullPath:dirName, children:[
    //                         {type:'file', name:fileName, fullPath:`${dirName}/${fileName}`}]}]})
    //             .then(() => matcher.expect([]));
    //     });

    //     it(`saving a file with different content`, function() {
    //         const newContent = `_${content}`;
    //         fs.saveFileSync(fileName, content)

    //         matcher.expect([{type: 'fileCreated', fullPath:fileName, newContent:content}]);
    //         expect(fs.loadTextFileSync(fileName)).to.equal(content)
    //         fs.saveFileSync(fileName, newContent)
    //         matcher.expect([{type: 'fileChanged', fullPath:fileName, newContent:newContent}]);
    //         expect(fs.loadTextFileSync(fileName)).to.equal(newContent);
    //         matcher.expect([]);
    //     });
    // })

}

