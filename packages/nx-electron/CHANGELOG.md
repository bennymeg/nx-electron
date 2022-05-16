# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [13.1.0](https://github.com/bennymeg/nx-electron/compare/v12.1.0...v13.1.0) (2022-05-16)


### Features

* added multiple preload scripts support [#155](https://github.com/bennymeg/nx-electron/issues/155) ([1adc422](https://github.com/bennymeg/nx-electron/commit/1adc4223e764acf2f40884b25c795c897f8d5057))
* do not generate package json while serving ([209702f](https://github.com/bennymeg/nx-electron/commit/209702f799933507ecda6b635dbcedf86fe82c98))
* migrate generate package json ([b0d839f](https://github.com/bennymeg/nx-electron/commit/b0d839f467037169d9e66599cd7dfefaecfc000a))
* **package:** add option for overriding maker options file [#151](https://github.com/bennymeg/nx-electron/issues/151) ([198c22c](https://github.com/bennymeg/nx-electron/commit/198c22c82d19043ade793f6c0dc058c7ff98a50c))
* **serve:** added rederer debugging port option [#136](https://github.com/bennymeg/nx-electron/issues/136) ([8958f32](https://github.com/bennymeg/nx-electron/commit/8958f32e060743ac77cab63bad3c45ded1e6265f))


### Bug Fixes

* app init asset folder generation ([bbe1661](https://github.com/bennymeg/nx-electron/commit/bbe1661234b9e971ea6c2b13c44a4f81208819ba))
* app init asset folder generation ([4acace3](https://github.com/bennymeg/nx-electron/commit/4acace3b86764beb2c1312a7e8bb8a57cbf5a033))
* app init asset folder generation (2) ([801f653](https://github.com/bennymeg/nx-electron/commit/801f653f1b3bf8e627de393b59ef72d457fcfbc6))
* deps audit ([22d8d00](https://github.com/bennymeg/nx-electron/commit/22d8d00dff56dc105c4a7657310e41a441e29b3a))
* empty maker option path ([d659149](https://github.com/bennymeg/nx-electron/commit/d659149d9cefd9c6c15c429b15d26f69842091fa))
* remove file extension from preload webpack entry ([b23abba](https://github.com/bennymeg/nx-electron/commit/b23abba69b43dfaa302dcdeeaa3f3282d3afa304))
* temporarly added angular-devkit ([6abd615](https://github.com/bennymeg/nx-electron/commit/6abd61509031ca7f22b28a5e49a7b9446718d89c))
* updated path delimeters for consistency ([5e90a9f](https://github.com/bennymeg/nx-electron/commit/5e90a9fb23c329440d200f3ecfd95572575bacb4))

## [12.1.0](https://github.com/bennymeg/nx-electron/compare/v12.0.0-beta.0...v12.1.0) (2022-02-04)


### Features

* defined schematics and builders entry point [#128](https://github.com/bennymeg/nx-electron/issues/128) ([83525b0](https://github.com/bennymeg/nx-electron/commit/83525b08a6b9b2f346a5186c90b096556d2a425b))
* v12 ([f420430](https://github.com/bennymeg/nx-electron/commit/f420430759273c46e65ec05630d81eb23adfdc2d))


### Bug Fixes

* add targets to the packaging options [#125](https://github.com/bennymeg/nx-electron/issues/125) ([cf70be6](https://github.com/bennymeg/nx-electron/commit/cf70be6361836ace667ea5f75960c27ece403869))
* bump version ([56ec734](https://github.com/bennymeg/nx-electron/commit/56ec734fd854de6c8e9a7b5b59051081e341c4c8))
* packager returns promise instead of observable [#135](https://github.com/bennymeg/nx-electron/issues/135) ([753997a](https://github.com/bennymeg/nx-electron/commit/753997a36a73083c6b76ff20cdcd4145f9a4094e))
* revert adding targets packaging options [#125](https://github.com/bennymeg/nx-electron/issues/125) ([5beb469](https://github.com/bennymeg/nx-electron/commit/5beb469ae5c92716fe4cb3fde4fdd31c953a5d8f))

## [12.0.0](https://github.com/bennymeg/nx-electron/compare/v11.4.1...v12.0.0) (2021-11-24)


### Features

* added compatibility layer ([0a15d54](https://github.com/bennymeg/nx-electron/commit/0a15d543df83005b900a06ffe2d5afed59f4c5b7))
* added multi package json support [#88](https://github.com/bennymeg/nx-electron/issues/88) ([997df2a](https://github.com/bennymeg/nx-electron/commit/997df2acd1c2eeb8c1c785e1d3709d368ccad62c))
* added multi preload scripts support as per [#118](https://github.com/bennymeg/nx-electron/issues/118) ([6b28c6a](https://github.com/bennymeg/nx-electron/commit/6b28c6ab8f4a79541d02b4cbb5e8b5accfd3b3dd))
* de-coupled [@angular-devkit](https://github.com/angular-devkit) from executors ([f5998b6](https://github.com/bennymeg/nx-electron/commit/f5998b691f7f27570c4a336d6718a100b1515904))
* de-coupled [@angular-devkit](https://github.com/angular-devkit) from generators ([86e0448](https://github.com/bennymeg/nx-electron/commit/86e0448d4bedcca240762b01319022c11e6c0a79))
* initial de-coupling of [@angular-devkit](https://github.com/angular-devkit) from tests ([d210d4a](https://github.com/bennymeg/nx-electron/commit/d210d4a1e2a7b7378b3c2ebd265cbedb556112da))
* **package:** add option for overriding make options file ([adb8bb9](https://github.com/bennymeg/nx-electron/commit/adb8bb9567fafda4d949d9c588f6c05fc1884d45))
* removed angular-devkit dependencies ([974eae2](https://github.com/bennymeg/nx-electron/commit/974eae24bc34994dc2efc0d77703212dab80e08c))


### Bug Fixes

* fixed build script ([d88fd0c](https://github.com/bennymeg/nx-electron/commit/d88fd0c3ab02bf9f9d2f47f2a4cdea52b4e059ff))
* fixed build script ([8a82b4c](https://github.com/bennymeg/nx-electron/commit/8a82b4ce8b75849f3dcf5f12c505fb0f69d2a635))
* migration ([130865f](https://github.com/bennymeg/nx-electron/commit/130865f2693467097ede468e21604639159b8f36))
* preload file regex pattern as per [#121](https://github.com/bennymeg/nx-electron/issues/121) ([b9a7da8](https://github.com/bennymeg/nx-electron/commit/b9a7da8f8a5de15ec0dd9e83a414e4fa7214aa47))
* schema $id field ([40e58f1](https://github.com/bennymeg/nx-electron/commit/40e58f17f3d60523fc485bc62587526b181b563a))
* update post install script instead of overwriting it. closes [#97](https://github.com/bennymeg/nx-electron/issues/97) ([de69c98](https://github.com/bennymeg/nx-electron/commit/de69c986598a8f8e7147d16db1a03bdeb7460095))
