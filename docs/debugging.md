# Debugging
In this document we will describe how to configure you IDE to debug your nx-electron application.

## VS Code Configurations

### Hot Reloading Debugger
- Launch.json configuration:
```
{
            "name": "Attach Main Process",
            "type": "node",
            "request": "attach",
            "port": 5858,
            "skipFiles": [
                "<node_internals>/**"
            ]
}
```

- package.json script
`"serve:main": "nx serve --inspect=inspect-brk {electron-app-name}"`

- Invocation:
  - Run this command before attaching the debugger:
    `npm run serve:main`

  - We cant use a task here due to the the live reload feature 


### Static Debugger
- Launch.json configuration:
```
{
            "name": "Debug Main Process",
            "type": "node",
            "request": "launch",
            "port": 5858,
            "cwd": "${workspaceFolder}",
            "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
            "windows": {
              "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron.cmd"
            },
            "args" : ["--inspect-brk=5858", "dist/apps/{electron-app-name}/main.js"],
            "outputCapture": "std",
            "preLaunchTask": "build:main"
}
```

- Tasks.json task:
```
{
        "label": "build:main",
        "type": "npm",
        "script": "build:main",
        "group": "build",
        "problemMatcher": ["$eslint-stylish"]
}
```

- package.json script
`"build:main": "nx build {electron-app-name}"`
