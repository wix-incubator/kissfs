# :kiss:fs
[![Build Status](https://travis-ci.org/wix/kissfs.svg?branch=master)](https://travis-ci.org/wix/kissfs)
[![Build Status](https://ci.appveyor.com/api/projects/status/github/wix/kissfs?branch=master&svg=true)](https://ci.appveyor.com/project/qballer/kissfs/branch/master)

Extensible and reactive file-system library that keeps it simple

## User documentation
:kiss:fs supplies a standard API for the most basic file-system operations: CRUD of modest sized text files and directories, as well as listening for changes to files and directories. If you're looking to build a folder tree visualizer or manager, or a tool for viewing and editing any text file in a directory tree, :kiss:fs is what you're looking for. For simplicity and supportability, we are keeping the focus narrow so that it can be widely implemented and extended over a wide range of data sources, such as local file systems, remote git APIs, cloud-based file systems, etc. For example, you can use it to run a rename script on an in memory directory for testing purposes and then run the same script on the directories requiring the change. 

There is currently no support for meta-data (timestamps, permissions, etc.), binary content or data streams. So if you're writing a log viewer or an all-in-one file system manager, this may not be the right tool for you and we suggest you try [vinyl](https://github.com/gulpjs/vinyl).

Feedback, questions and contributions always welcome via issues.


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

## similar solutions
 - [vinyl](https://github.com/gulpjs/vinyl) - a standard API for file descriptors, designed for gulp. More complex than :kiss:fs.
 - 
