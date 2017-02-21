# :kiss:fs
[![Build Status](https://travis-ci.org/wix/kissfs.svg?branch=master)](https://travis-ci.org/wix/kissfs)
[ ![Build Status](https://ci.appveyor.com/api/projects/status/github/wix/kissfs?branch=master&svg=true)] (https://ci.appveyor.com/project/qballer/kissfs/branch/master)

Extensible and reactive file-system library that keeps it simple

## User documentation
:kiss:fs is all about supplying a standard API for the most basic file-system operations: CRUD of modest sized text files and directories, and registering for changes. For the purpose of simplicity, there is currently no support for meta-data (timestamps, permissions etc.), binary content, or even data streams. So if you're writing a log viewer or an all-in-one file system manager, this is probably not the right tool for you :(
However, If you're looking to build a folder tree visualizer or manager, or a tool for viewing and editing any text file in a directory tree, :kiss:fs is what you're looking for.

### usage code examples
coming soon...

## developer documentation
how to build and test:
 - clone the repository
 - in the cloned folder, run `npm install`
 - run `npm test` to build and test the code in both nodejs and browser

how to debug (browser):
 - run `npm build:watch` to start transpiling all source files to es5 whenever they change (CTR+c to exit)
 - in a different window, run `npm start` to run a development server that watches the es5 files and serves them to the browser
 - open `http://localhost:8080/webtest.bundle` to run live tests that will update while you change the source code

