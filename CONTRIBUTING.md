# Contributing

- 👾 [Issue Tracker](https://github.com/bennymeg/nx-electron/issues),
- 📦 [Source Code](https://github.com/bennymeg/nx-electron/)

## How to Contribute

- fork the `nx-electron` package from github: 
    - `git clone https://github.com/bennymeg/nx-electron.git`
- link the forked project:
    - `cd nx-electron && npm link`
- make your desired changes to your fork of the nx-electron repo
- (in a new directory?) create a new test project and link your forked project into it:
    - `npx create-nx-workspace nx-electron-test` (select `angular` for the front-end/UI)
    - `cd nx-electron-test && npm link nx-electron`
    - `nx g nx-electron:app <electron-test-app-name> --frontendProject=<frontend-test-app-name>`
    - test your changes (e.g. serving, building, packaging, making, etc..)
- test the forked project and make sure it completes without any warnnings
    - `npm run test`
- lint the forked project and make sure it completes without any warnnings
    - `npm run lint`
- open a pull request
