#!/usr/bin/env node

const { join } = require('path');
const { writeFileSync } = require('fs');
const originalPkgJson = require(join(__dirname, '../package.json'));
const updatedPkgJson = { ...originalPkgJson, private: false };

writeFileSync(
  join(__dirname, '../build/package.json'),
  JSON.stringify(updatedPkgJson, null, 2)
);
