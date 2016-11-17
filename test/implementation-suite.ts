import {expect} from "chai";
import {FileSystem, FileSystemNode, FileChangeEvent, FileDeleteEvent, Directory} from '../src/types/api';
import * as Promise from 'bluebird';
import * as _ from 'lodash';

export function assertContract(fsProvider: () => FileSystem, applyEventTests:boolean) {
    it(`loads and saves a file`, function() {
        const filename = 'foo.txt';
        const fs = fsProvider();
        return fs.saveFile(filename, 'bar')
            .then(() => fs.loadTextFile(filename))
            .then(content => expect(content).to.equal('bar'))
            .then(() => fs.saveFile(filename, 'baz'))
            .then(() => fs.loadTextFile(filename))
            .then(content => expect(content).to.equal('baz'));
    });

    it(`provides working directory tree for path`, function() {
        const fs = fsProvider();
        return fs.saveFile('src/pages/gaga.html','<html><div>gaga</div></html>')
            .then(() => fs.saveFile('src/pages/baga.html','<html><div>baga</div></html>'))
            .then(() => fs.loadDirectoryTree())
            .then(rootData => {

                const data = _.find(rootData.children,((child:FileSystemNode)=> child.name==='src')) as Directory;

                expect(data.name).to.equal('src');
                expect(data.type).to.equal('dir');
                expect(data.fullPath).to.equal('src');

                expect(data.children.length,'first level children').to.equal(1);
                var child2nd = data.children[0] as Directory;
                expect(child2nd.name).to.equal('pages');
                expect(child2nd.type).to.equal('dir');
                expect(child2nd.fullPath).to.equal('src/pages');
                expect(child2nd.children.length,'second level children').to.equal(2);
                expect(child2nd.children).to.include({
                    name: 'baga.html',
                    type: 'file',
                    fullPath: 'src/pages/baga.html'
                });
                expect(child2nd.children).to.include({
                    name: 'gaga.html',
                    type: 'file',
                    fullPath: 'src/pages/gaga.html'
                });
            });
    });

    if(applyEventTests) {
        it(`listens to file changes`, function(done) {
            this.timeout(1000 * 5);

            const fs = fsProvider();
            const newValue = 'newValue';
            const expectedFileName = 'index.html';

            fs.events.on('fileChanged', function(event:FileChangeEvent) {
                if (event.source === newValue && event.filename === expectedFileName) {
                    done();
                }
            });

            fs.saveFile(expectedFileName, newValue);
        });

        it(`listen to file delete`, function(){
            const expectedFileName = 'src/file.txt';
            const fs = fsProvider();
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
    }
}

