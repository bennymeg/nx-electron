# Migrating To Version 9.0.0

**1.** In `angular.json` file, add the following line to `projects > {electron-app-name} > architect`:
```json
    "make": {
        "builder": "nx-electron:make",
        "options": {
            "name": "{electron-app-name}",
            "frontendProject": "{frontend-app-name}",
            "out": "dist/executables"
        }
    },
```

**2.** Add the following static packaging options file `.\apps\<electron-app-name>\src\app\options\maker.options.json`:
```json
{
  "$schema": "../../../../../node_modules/nx-electron/src/validation/maker.schema.json"
} 
```

**3.** Update `constants.ts` module `packageVersion` variable:
```ts
declare const __BUILD_VERSION__: String;

export const packageVersion = __BUILD_VERSION__;

...
```
**Note**: In new projects the version variable will bw placed in the `environment.ts` module