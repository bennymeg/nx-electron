<p align="center"><img src="https://raw.githubusercontent.com/bennymeg/nx-electron/master/nx-electron.png" width="240"></p>

<div align="center">

# Nx Electron
Electron builders and schematics for Nrwl Nx platform.

[![licence](https://img.shields.io/github/license/bennymeg/nx-electron.svg)](https://github.com/bennymeg/nx-electron/blob/master/LICENSE)
[![npm version](https://img.shields.io/npm/v/nx-electron.svg)](https://www.npmjs.com/package/nx-electron)
[![Dependencies status](https://david-dm.org/bennymeg/nx-electron/status.svg)](https://david-dm.org/bennymeg/nx-electron)
<!-- [![github version](https://img.shields.io/github/package-json/v/badges/shields.svg)](https://github.com/bennymeg/nx-electron) -->
<!-- ![GitHub repository size in bytes](https://img.shields.io/github/languages/code-size/badges/shields.svg) -->

</div>

<hr></br>

# Features

Nx Electron provides a set of power ups on [Nx](https://nx.dev) for developing cross platform desktop apps using [Electron](https://electronjs.org/).
- **Schematics**: Provides schematics for developing cross platform apps in a mono repo environment.
- **Typescript**: Uses Typescript code.
- **Obfuscation**: Since Electron are used on the client machines, nx-electron obfuscates you code (and only it).
- **Minimization**: Electron apps tend to be quite large, hence we use webpack to bundle, and minimize to code.
- **Live Update**: Provides continuos live reload for your backend code.
- **Coming Soon**: _Packaging, making, auto-updates, distributing and more..._

# Getting Started

## Prerequisite

This module is based on Nx, you will need to [set up an Nx workspace](https://nx.dev/web/getting-started/getting-started) before you can use this nx-electron.

## Installation

```bash
npm install -D nx-electron
```

## Creating Electron Application

```bash
nx g nx-electron:app <electron-app-name>
```

## Building Electron Application

- Run `nx build <electron-app-name>` to build your application.

## Serving Electron Application

- Run `nx serve <electron-app-name>` to serve your application.
- Run `nx test <electron-app-name>` to test your application.
- Run `nx e2e <electron-app-name-e2e>` to run e2e tests for your application.

<!-- ## Documentation ##  
- 👨🏼‍💻 [API](https://github.com/bennymeg/nx-electron/blob/master/docs/API.md),  
- 👩🏼‍🏫 [Examples](https://github.com/bennymeg/nx-electron/blob/master/docs/examples),  
- 📜 [Change log](https://github.com/bennymeg/nx-electron/blob/master/docs/CHANGELOG.md),  
- 🖋 [Licence](https://github.com/bennymeg/nx-electron/blob/master/LICENSE) -->

## Support ##
If you're having any problem, please [raise an issue](https://github.com/bennymeg/nx-electron/issues/new) on GitHub and we'll be happy to help.


## Contribute ##

Before submitting a pull request, please make sure that you include tests and lints runs without any warnings.

- 👾 [Issue Tracker](https://github.com/bennymeg/nx-electron/issues),
- 📦 [Source Code](https://github.com/bennymeg/nx-electron/)

## Versioning ##

This repository follows the semantic versioning rules while adhering to Nx and Angular version scheme.


</br><hr>
**Author:** Benny Megidish.