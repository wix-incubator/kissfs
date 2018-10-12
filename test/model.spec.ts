import {Directory, DirectoryContent} from '../src/universal';
import {expect} from 'chai';

const emptyContent: DirectoryContent = {};

const content = {
    'a.file': 'hello',
    'src': {
        'a.ts': 'a',
        'b.js': 'b',
        'nested': {
            'file.zag': 'nested-file'
        }
    }
};

const mixinContent = {
    'b.file': 'hello',
    'src': {
        'nested': {
            'file2.zag': 'new file'
        }
    }
};

const mixedContent = {
    'a.file': 'hello',
    'b.file': 'hello',
    'src': {
        'a.ts': 'a',
        'b.js': 'b',
        'nested': {
            'file.zag': 'nested-file',
            'file2.zag': 'new file'
        }
    }
};

describe('model', () => {
    describe('Directory.fromContent', () => {
        it('works on empty input', async () => {
            const emptyDirectory: Directory = {
                'fullPath': '',
                'name': '',
                'type': 'dir',
                'children': []
            };
            expect(Directory.fromContent(emptyContent)).to.eql(emptyDirectory);
        });
        it('works on input with data', async () => {
            const contentAsDirectory: Directory = {
                'fullPath': '',
                'name': '',
                'type': 'dir',
                'children': [{
                    'content': 'hello',
                    'fullPath': 'a.file',
                    'name': 'a.file',
                    'type': 'file'
                }, {
                    'children': [{
                        'content': 'a',
                        'fullPath': 'src/a.ts',
                        'name': 'a.ts',
                        'type': 'file',
                    }, {
                        'content': 'b',
                        'fullPath': 'src/b.js',
                        'name': 'b.js',
                        'type': 'file',
                    }, {
                        'children': [{
                            'content': 'nested-file',
                            'fullPath': 'src/nested/file.zag',
                            'name': 'file.zag',
                            'type': 'file',
                        }],
                        'fullPath': 'src/nested',
                        'name': 'nested',
                        'type': 'dir',
                    }],
                    'fullPath': 'src',
                    'name': 'src',
                    'type': 'dir'
                }]
            };
            expect(Directory.fromContent(content)).to.eql(contentAsDirectory);
        });

        it('can override name', async () => {
            expect(Directory.fromContent(content, 'foo')).to.eql(Directory.fromContent({foo: content}).children.find(c => c.name === 'foo'));
        });
        it('can override name and location', async () => {
            const contentAsDirectory: Directory = {
                'children': [{
                    'content': 'hello',
                    'fullPath': 'bar/baz/foo/a.file',
                    'name': 'a.file',
                    'type': 'file'
                }, {
                    'children': [{
                        'content': 'a',
                        'fullPath': 'bar/baz/foo/src/a.ts',
                        'name': 'a.ts',
                        'type': 'file'
                    }, {
                        'content': 'b',
                        'fullPath': 'bar/baz/foo/src/b.js',
                        'name': 'b.js',
                        'type': 'file'
                    }, {
                        'children': [{
                            'content': 'nested-file',
                            'fullPath': 'bar/baz/foo/src/nested/file.zag',
                            'name': 'file.zag',
                            'type': 'file'
                        }],
                        'fullPath': 'bar/baz/foo/src/nested',
                        'name': 'nested',
                        'type': 'dir',
                    }
                    ],
                    'fullPath': 'bar/baz/foo/src',
                    'name': 'src',
                    'type': 'dir'
                }
                ],
                'fullPath': 'bar/baz/foo',
                'name': 'foo',
                'type': 'dir'
            };
            expect(Directory.fromContent(content, 'foo', 'bar/baz')).to.eql(contentAsDirectory);
        });
    });

    describe('Directory.getSubDir', () => {
        it('works on empty input and empty path', async () => {
            expect(Directory.getSubDir(Directory.fromContent({}), '')).to.eql(Directory.fromContent({}));
        });
        it('works on input with data and empty path', async () => {
            expect(Directory.getSubDir(Directory.fromContent(content), '')).to.eql(Directory.fromContent(content));
        });
        it('works on input with data and real path', async () => {
            expect(Directory.getSubDir(Directory.fromContent(content), 'src/nested')).to.eql(Directory.fromContent(content.src.nested, 'nested', 'src'));
        });
    });


    describe('Directory.toContent', () => {
        it('works on empty input', async () => {
            expect(Directory.toContent(Directory.fromContent({}))).to.eql(emptyContent);
        });
        it('works on input with data', async () => {
            expect(Directory.toContent(Directory.fromContent(content))).to.eql(content);
        });
    });

    describe('Directory.clone', () => {
        it('works on empty input', async () => {
            expect(Directory.clone(Directory.fromContent({}))).to.eql(Directory.fromContent({}));
        });
        it('works on input with data', async () => {
            expect(Directory.clone(Directory.fromContent(content))).to.eql(Directory.fromContent(content));
        });
        it('can override path', async () => {
            expect(Directory.clone(Directory.fromContent(content), 'foo')).to.eql(Directory.fromContent(content, 'foo'));
        });
    });

    describe('Directory.cloneStructure', () => {
        it('works on empty input', async () => {
            expect(Directory.cloneStructure(Directory.fromContent({}))).to.eql(Directory.fromContent({}));
        });
        it('works on input with data', async () => {
            const contentAsDirectoryStructure: Directory = {
                'fullPath': '',
                'name': '',
                'type': 'dir',
                'children': [{
                    'fullPath': 'a.file',
                    'name': 'a.file',
                    'type': 'file'
                }, {
                    'children': [{
                        'fullPath': 'src/a.ts',
                        'name': 'a.ts',
                        'type': 'file',
                    }, {
                        'fullPath': 'src/b.js',
                        'name': 'b.js',
                        'type': 'file',
                    }, {
                        'children': [{
                            'fullPath': 'src/nested/file.zag',
                            'name': 'file.zag',
                            'type': 'file',
                        }],
                        'fullPath': 'src/nested',
                        'name': 'nested',
                        'type': 'dir',
                    }],
                    'fullPath': 'src',
                    'name': 'src',
                    'type': 'dir'
                }]
            };
            expect(Directory.cloneStructure(Directory.fromContent(content))).to.eql(contentAsDirectoryStructure);
        });
    });

    describe('Directory.mix', () => {
        it('returns subject', async () => {
            let subject = Directory.fromContent({});
            expect(Directory.mix(subject, Directory.fromContent({}))).to.equal(subject);
        });
        it('works on empty input', async () => {
            expect(Directory.mix(Directory.fromContent({}), Directory.fromContent({}))).to.eql(Directory.fromContent({}));
        });
        it('works on input with data', async () => {
            expect(Directory.mix(Directory.fromContent({}), Directory.fromContent(content))).to.eql(Directory.fromContent(content));
        });
        it('works on subject with same data', async () => {
            expect(Directory.mix(Directory.fromContent(content), Directory.fromContent(content))).to.eql(Directory.fromContent(content));
        });
        it('works on mix with additional data', async () => {
            let mixed = Directory.mix(Directory.fromContent(content), Directory.fromContent(mixinContent));
            let expected = Directory.fromContent(mixedContent);

            // a trick to structural equality with no regards to ordering in arrays
            // (a contains b && b contains a) === a equals b
            expect(mixed).to.containSubset(expected);
            expect(expected).to.containSubset(mixed);
        });
        it('works on mix with different file content', async () => {
            const content2 = Object.create(content);
            content2['a.file'] = 'new content';

            expect(content2, 'false-positive test! content2 should override existing content file').to.not.containSubset(content);

            let mixed = Directory.mix(Directory.fromContent(content), Directory.fromContent(content2));
            expect(mixed).to.containSubset(Directory.fromContent(content2));
        });
    });
});
