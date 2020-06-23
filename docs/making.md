# Making Options

Nx Electron uses behind th scene Electron Builder.
You can find a detailed description of all of its available options [here](https://www.electron.build/configuration/configuration).
**Note:** in order to avoid confusion, the cli `publish` parameter have been renamed to `publishPolicy`.

## Configuring static making options

It is possible to configure all the packaging that are describes above in _`.\apps\<electron-app-name>\src\app\options\maker.options.json`_.
**Notice:** the option you define at this file will override the options you pass manually via the command line or choose via the angular console.

Example static packaging options file (_`.\apps\<electron-app-name>\src\app\options\maker.options.json`_):
```json
{
  "$schema": "../../../../../node_modules/nx-electron/src/validation/maker.schema.json",
  "productName": "Awesome App",
  "copyright": "Copyright © 2020 Benny Megidish",
  "electronCompile": false,
  "npmRebuild": false,
  "asar": true,
  "win": {
    "target": "appx",
    "icon": "relative\\path\\to\\app_icon.ico",
    "certificateFile": "relative\\path\\to\\certificate.pfx",
    "publisherName": "Benny Megidish"
  },
  "appx": {   
    "displayName": "Awesome App",
    "publisherDisplayName": "Benny Megidish",
    "backgroundColor": "transparent"
  }
} 
```