# Packaging Options

This file is a derivative of electron packager options. It states all the available options that can be used when packaging you app using nx electron. Fundamentally, all of the electron packager options are available except the functions hooks (afterCopy, afterExtract, afterPrune). In addition, you can pass the --ignoreSourceMap option in order to ignore all the source map files in your package.

## Configuring static packaging options

It is possible to configure all the packaging that are described above in _`.\apps\<electron-app-name>\src\app\options\packager.options.json`_.
**Notice:** the option you define at this file will override the options you pass manually via the command line or choose via the angular console.

Example static packaging options file (_`.\apps\<electron-app-name>\src\app\options\packager.options.json`_):
```json
{
  "$schema": "../../../../../node_modules/nx-electron/src/validation/packager.schema.json",
  "prune": true,
  "executableName": "Awesome App",
  "appCopyright": "Copyright (c) Benny Megidish. All rights reserved.",
  "ignore": ["tools", "libs", "dist/apps/unwanted-app","(angular|nx)\\.json", "\\.vscode"],
  "ignoreSourceMap": true
} 
```

## Options

#### All Platforms

#### `dir`

*String*

The source directory.

##### `all`

*Boolean*

When `true`, sets both [`arch`](#arch) and [`platform`](#platform) to `all`.

##### `appCopyright`

*String*

The human-readable copyright line for the app. Maps to the `LegalCopyright` metadata property on Windows, and `NSHumanReadableCopyright` on macOS.

##### `appVersion`

*String*

The release version of the application. By default the `version` property in the `package.json` is used but it can be overridden with this argument. If neither are provided, the version of Electron will be used. Maps to the `ProductVersion` metadata property on Windows, and `CFBundleShortVersionString` on macOS.

#### `arch`

*String* (default: the arch of the host computer running Node)

Allowed values: `ia32`, `x64`, `armv7l`, `arm64` _(Electron 1.8.0 and above)_, `mips64el`
_(Electron 1.8.2-beta.5 to 1.8.8)_, `all`

The target system architecture(s) to build for.
Not required if the [`all`](#all) option is set.
If `arch` is set to `all`, all supported architectures for the target platforms specified by [`platform`](#platform) will be built.
Arbitrary combinations of individual architectures are also supported via a comma-delimited string or array of strings.
The non-`all` values correspond to the architecture names used by [Electron releases]. This value
is not restricted to the official set if [`download.mirrorOptions`](#download) is set.

##### `asar`

*Boolean* or *Object* (default: `false`)

Whether to package the application's source code into an archive, using [Electron's archive format](https://github.com/electron/asar). Reasons why you may want to enable this feature are described in [an application packaging tutorial in Electron's documentation](https://electronjs.org/docs/tutorial/application-packaging/). When the value is `true`, pass default configuration to the `asar` module. The configuration values listed below can be customized when the value is an `Object`. Supported parameters include, but are not limited to:
- `ordering` (*String*): A path to an ordering file for packing files. An explanation can be found on the [Atom issue tracker](https://github.com/atom/atom/issues/10163).
- `unpack` (*String*): A [glob expression](https://github.com/isaacs/minimatch#features), when specified, unpacks the file with matching names to the `app.asar.unpacked` directory.
- `unpackDir` (*String*): Unpacks the dir to the `app.asar.unpacked` directory whose names exactly or pattern match this string. The `asar.unpackDir` is relative to `dir`.

  Some examples:

  - `asar.unpackDir = 'sub_dir'` will unpack the directory `/<dir>/sub_dir`
  - `asar.unpackDir = '**/{sub_dir1/sub_sub_dir,sub_dir2}/*'` will unpack the directories `/<dir>/sub_dir1/sub_sub_dir` and `/<dir>/sub_dir2`, but it will not include their subdirectories.
  - `asar.unpackDir = '**/{sub_dir1/sub_sub_dir,sub_dir2}/**'` will unpack the subdirectories of the directories `/<dir>/sub_dir1/sub_sub_dir` and `/<dir>/sub_dir2`.
  - `asar.unpackDir = '**/{sub_dir1/sub_sub_dir,sub_dir2}/**/*'` will unpack the directories `/<dir>/sub_dir1/sub_sub_dir` and `/<dir>/sub_dir2` and their subdirectories.

**Note:** `asar` will have no effect if [`prebuiltAsar`](#prebuiltasar) is set.

##### `buildVersion`

*String*

The build version of the application. Defaults to the value of [`appVersion`](#appversion). Maps to the `FileVersion` metadata property on Windows, and `CFBundleVersion` on macOS.

##### `derefSymlinks`

*Boolean* (default: `true`)

Whether symlinks should be dereferenced during the copying of the application source.

**Note:** `derefSymlinks` will have no effect if [`prebuiltAsar`](#prebuiltasar) is set.

##### `download`

*Object*

If present, passes custom options to [`@electron/get`](https://npm.im/@electron/get)
(see the link for more detailed option descriptions, proxy support, and the defaults). Supported
parameters include, but are not limited to:
- `cacheRoot` (*String*): The directory where prebuilt, pre-packaged Electron downloads are cached.
- `mirrorOptions` (*Object*): Options to override the default Electron download location.
- `rejectUnauthorized` (*Boolean* - default: `true`): Whether SSL certificates are required to be
  valid when downloading Electron.

**Note:** `download` sub-options will have no effect if [`electronZipDir`](#electronzipdir) is set.

##### `electronVersion`

*String*

The Electron version with which the app is built (without the leading 'v') - for example,
[`1.4.13`](https://github.com/electron/electron/releases/tag/v1.4.13). See [Electron releases] for
valid versions. If omitted, it will use the version of the nearest local installation of
`electron`, `electron-prebuilt-compile`, or `electron-prebuilt`, defined in `package.json` in either
`dependencies` or `devDependencies`.

##### `electronZipDir`

*String*

The local path to a directory containing Electron ZIP files for Electron Packager to unzip, instead
of downloading them. The ZIP filenames should be in the same format as the ones downloaded from the
Electron releases site.

**Note:** Setting this option prevents the [`download`](#download) sub-options from being used, as
the functionality gets skipped over.

##### `extraResource`

*String* or *Array* of *String*s

One or more files to be copied directly into the app's `Contents/Resources` directory for macOS
target platforms, and the `resources` directory for other target platforms.

##### `executableName`

*String*

The name of the executable file (sans file extension). Defaults to the value for the [`name`](#name)
parameter. For `darwin` or `mas` target platforms, this does not affect the name of the `.app`
folder - this will use [`name`](#name) parameter.

##### `icon`

*String*

The local path to the icon file, if the target platform supports setting embedding an icon.

Currently you must look for conversion tools in order to supply an icon in the format required by the platform:

- macOS: `.icns`
- Windows: `.ico` ([See the readme](https://github.com/electron/electron-packager#building-windows-apps-from-non-windows-platforms) for details on non-Windows platforms)
- Linux: this option is not supported, as the dock/window list icon is set via
  [the `icon` option in the `BrowserWindow` constructor](https://electronjs.org/docs/api/browser-window/#new-browserwindowoptions).
  *Please note that you need to use a PNG, and not the macOS or Windows icon formats, in order for it
  to show up in the dock/window list.* Setting the icon in the file manager is not currently supported.

If the file extension is omitted, it is auto-completed to the correct extension based on the platform, including when [`platform: 'all'`](#platform) is in effect.

##### `ignore`

*RegExp*, *Array* of *RegExp*s, or *Function*

One or more additional [regular expression](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions)
patterns which specify which files to ignore when copying files to create the app bundle(s). The
regular expressions are matched against the absolute path of a given file/directory to be copied.

The following paths are always ignored (*when you aren't using the predicate function that is
described after the list*):

* the directory specified by the [`out`](#out) parameter
* the temporary directory used to build the Electron app
* `node_modules/.bin`
* `node_modules/electron`
* `node_modules/electron-prebuilt`
* `node_modules/electron-prebuilt-compile`
* `.git`
* files and folders ending in `.o` and `.obj`

**Please note that [glob patterns](https://en.wikipedia.org/wiki/Glob_%28programming%29) will not work.**

**Note**: Node modules specified in `devDependencies` are ignored by default, via the
[`prune`](#prune) option.

Alternatively, this can be a predicate function that, given an absolute file path, returns `true` if
the file should be ignored, or `false` if the file should be kept. *This does not use any of the
default ignored files/directories listed above.*

**Note:** `ignore` will have no effect if [`prebuiltAsar`](#prebuiltasar) is set.

##### ignoreSourceMap 

*Boolean* (default: `false`)

Ignores [source map files](https://developer.mozilla.org/en-US/docs/Tools/Debugger/How_to/Use_a_source_map) when copying the Electron app,
regardless of the [`ignore`](#ignore) option.

##### `junk`

*Boolean* (default: `true`)

Ignores [system junk files](https://github.com/sindresorhus/junk) when copying the Electron app,
regardless of the [`ignore`](#ignore) option.

**Note:** `junk` will have no effect if [`prebuiltAsar`](#prebuiltasar) is set.

##### `name`

*String*

The application name. If omitted, it will use the `productName` or `name` value from the nearest `package.json`.

**Regardless of source, characters in the Electron app name which are not allowed in all target
platforms' filenames (e.g., `/`), will be replaced by hyphens (`-`).**

##### `out`

*String* (default: current working directory)

The base directory where the finished package(s) are created.

##### `overwrite`

*Boolean* (default: `false`)

Whether to replace an already existing output directory for a given platform (`true`) or skip recreating it (`false`).

##### `platform`

*String* (default: the arch of the host computer running Node)

Allowed values: `linux`, `win32`, `darwin`, `mas`, `all`

The target platform(s) to build for.
Not required if the [`all`](#all) option is set.
If `platform` is set to `all`, all [supported target platforms](#supported-platforms) for the target architectures specified by [`arch`](#arch) will be built.
Arbitrary combinations of individual platforms are also supported via a comma-delimited string or array of strings.
The non-`all` values correspond to the platform names used by [Electron releases]. This value
is not restricted to the official set if [`download.mirrorOptions`](#download) is set.

##### `prebuiltAsar`

*String*

The path to a prebuilt ASAR file.

**Note:** Setting this option prevents the following options from being used, as the functionality
gets skipped over:

* [`asar`](#asar)
* [`afterCopy`](#aftercopy)
* [`afterPrune`](#afterprune)
* [`derefSymlinks`](#derefsymlinks)
* [`ignore`](#ignore)
* [`junk`](#junk)
* [`prune`](#prune)

##### `prune`

*Boolean* (default: `true`)

Walks the `node_modules` dependency tree to remove all of the packages specified in the
`devDependencies` section of `package.json` from the outputted Electron app.

**Note:** `prune` will have no effect if [`prebuiltAsar`](#prebuiltasar) is set.

##### `quiet`

*Boolean* (default: `false`)

If `true`, disables printing informational and warning messages to the console when packaging the
application. This does *not* disable errors.

##### `tmpdir`

*String* or *`false`* (default: system temp directory)

The base directory to use as a temp directory. Set to `false` to disable use of a temporary directory.

#### macOS/Mac App Store targets only

##### `appBundleId`

*String*

The bundle identifier to use in the application's plist.

##### `appCategoryType`

*String*

The application category type, as shown in the Finder via *View → Arrange by Application Category* when viewing the Applications directory.

For example, `app-category-type=public.app-category.developer-tools` will set the application category to *Developer Tools*.

Valid values are listed in [Apple's documentation](https://developer.apple.com/library/ios/documentation/General/Reference/InfoPlistKeyReference/Articles/LaunchServicesKeys.html#//apple_ref/doc/uid/TP40009250-SW8).

##### `darwinDarkModeSupport`

*Boolean* (default: `false`)

Forces support for Mojave (macOS 10.14) dark mode in your packaged app. This sets the
`NSRequiresAquaSystemAppearance` key to `false` in your app's `Info.plist`.  For more information,
see the [Apple developer documentation](https://developer.apple.com/documentation/appkit/nsappearancecustomization/choosing_a_specific_appearance_for_your_app).

##### `extendInfo`

*String* or *Object*

When the value is a `String`, the filename of a plist file. Its contents are added to the app's plist. When the value is an `Object`, an already-parsed plist data structure that is merged into the app's plist.

Entries from `extend-info` override entries in the base plist file supplied by `electron`, `electron-prebuilt-compile`, or `electron-prebuilt`, but are overridden by other explicit arguments such as [`appVersion`](#appversion) or [`appBundleId`](#appbundleid).

##### `helperBundleId`

*String*

The bundle identifier to use in the application helper's plist.

##### `osxNotarize`

*Object*

**Requires [`osxSign`](#osxsign) to be set.**

If present, notarizes macOS target apps when the host platform is macOS and XCode is installed.  The configuration values listed below can be customized. See [`electron-notarize`](https://github.com/electron-userland/electron-notarize#method-notarizeopts-promisevoid) for more detailed option descriptions and how to use `appleIdPassword` safely.
- `appleId` (*String*, **required**): Your Apple ID username / email
- `appleIdPassword` (*String*, **required**): The password for your Apple ID, can be a keychain reference

##### `osxSign`

*Object* or *`true`*

If present, signs macOS target apps when the host platform is macOS and XCode is installed. When the value is `true`, pass default configuration to the signing module. The configuration values listed below can be customized when the value is an `Object`. See [electron-osx-sign](https://www.npmjs.com/package/electron-osx-sign#opts) for more detailed option descriptions and the defaults.
- `identity` (*String*): The identity used when signing the package via `codesign`.
- `entitlements` (*String*): The path to the 'parent' entitlements.
- `entitlements-inherit` (*String*): The path to the 'child' entitlements.

##### `protocols`

*Array* of *Object*​s

One or more URL protocols associated with the Electron app.

Each *Object* is required to have the following properties:

- `name` (*String*): The descriptive name. Maps to the `CFBundleURLName` metadata property.
- `schemes` (*Array* of *String*​s): One or more protocol schemes associated with the app. For
  example, specifying `myapp` would cause URLs such as `myapp://path` to be opened with the app.
  Maps to the `CFBundleURLSchemes` metadata property.

##### `usageDescription`

*Object*

Human-readable descriptions of how the Electron app uses certain macOS features. These are displayed
in the App Store. A non-exhaustive list of available properties:

* `Camera` - required for media access API usage in macOS Catalina
* `Microphone` - required for media access API usage in macOS Catalina

Valid properties are the [Cocoa keys for MacOS](https://developer.apple.com/library/archive/documentation/General/Reference/InfoPlistKeyReference/Articles/CocoaKeys.html)
of the pattern `NS(.*)UsageDescription`, where the captured group is the key to use.

Example:

```javascript
{
  usageDescription: {
    Camera: 'Needed for video calls',
    Microphone: 'Needed for voice calls'
  }
}
```

#### Windows targets only

##### `win32metadata`

*Object*

Object (also known as a "hash") of application metadata to embed into the executable:
- `CompanyName` (defaults to `author` name from the nearest `package.json`)
- `FileDescription` (defaults to either `productName` or `name` from the nearest `package.json`)
- `OriginalFilename` (defaults to renamed `.exe` file)
- `ProductName` (defaults to either `productName` or `name` from the nearest `package.json`)
- `InternalName` (defaults to either `productName` or `name` from the nearest `package.json`)
- `requested-execution-level`
- `application-manifest`

For more information, see the [`node-rcedit` module](https://github.com/electron/node-rcedit).

## Return value

### `appPaths`

*Array* of *String*s

Paths to the newly created application bundles.

[Electron releases]: https://github.com/electron/electron/releases
