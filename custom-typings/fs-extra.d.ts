/*
 MIT License

 Copyright (c) 2016 Tim Perry

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all
 copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 SOFTWARE.
 */

// copied from https://github.com/pimterry/dev-bot-tool/blob/master/custom-typings/fs-extra.d.ts

declare module "fs-extra" {
    import { Stats } from "fs";
    import { Readable } from "stream";
    export * from "@types/fs-extra";

    export function walk(path: string): WalkEventEmitter;

    export interface WalkEventEmitter extends Readable {
        on(event: 'data', callback: (file: WalkEventFile) => void);
        on(event: 'end', callback: () => void);
        on(event: string, callback: Function);
        read():WalkEventFile;
    }

    export interface WalkEventFile {
        path: string;
        stats: Stats;
    }
}
