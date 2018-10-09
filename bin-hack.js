#!/usr/bin/env node
// this is necessary because TS doesn't map input perms => output perms. it drops execute perms, specifically
require('./build/bin.js')
