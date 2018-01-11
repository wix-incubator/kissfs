import {checkExistsSync, MemoryFileSystem} from "../src/universal";
import {expect} from "chai";
import {checkExists} from "../src/user-utils";
import {NoFeedbackEventsFileSystem} from "../src/no-feedback-events-fs";

describe('user-utils', () => {
    describe('checkExistsSync', () => {
        const fs = new MemoryFileSystem('', {content: {foo: {bar: {"a.file": 'hello'}}}});

        it('true for existing file', () => {
            expect(checkExistsSync('file', fs, 'foo/bar/a.file')).to.eql(true);
        });
        it('true for existing dir', () => {
            expect(checkExistsSync('dir', fs, 'foo/bar')).to.eql(true);
        });
        it('false for non existing file', () => {
            expect(checkExistsSync('file', fs, 'a/foo/bar/a.file')).to.eql(false);
        });
        it('false for non existing dir', () => {
            expect(checkExistsSync('dir', fs, 'a/foo/bar')).to.eql(false);
        });
        it('false for existing file when looking for dir', () => {
            expect(checkExistsSync('dir', fs, 'foo/bar/a.file')).to.eql(false);
        });
        it('false for non existing dir when looking for file', () => {
            expect(checkExistsSync('file', fs, 'foo/bar')).to.eql(false);
        });
    });
    describe('checkExists', () => {
        // use NoFeedbackEventsFileSystem as a proxy that does not expose sync methods
        const fs = new NoFeedbackEventsFileSystem(new MemoryFileSystem('', {content: {foo: {bar: {"a.file": 'hello'}}}}));

        it('true for existing file', async () => {
            expect(await checkExists('file', fs, 'foo/bar/a.file')).to.eql(true);
        });
        it('true for existing dir', async () => {
            expect(await checkExists('dir', fs, 'foo/bar')).to.eql(true);
        });
        it('false for non existing file', async () => {
            expect(await checkExists('file', fs, 'a/foo/bar/a.file')).to.eql(false);
        });
        it('false for non existing dir', async () => {
            expect(await checkExists('dir', fs, 'a/foo/bar')).to.eql(false);
        });
        it('false for existing file when looking for dir', async () => {
            expect(await checkExists('dir', fs, 'foo/bar/a.file')).to.eql(false);
        });
        it('false for non existing dir when looking for file', async () => {
            expect(await checkExists('file', fs, 'foo/bar')).to.eql(false);
        });
    });
});
