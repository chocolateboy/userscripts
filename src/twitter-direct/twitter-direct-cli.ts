#!/usr/bin/env bun

/// <reference types="@types/bun" />

// run the URL replacer on a local JSON file
//
// usage:
//
//     twitter-direct-cli.ts /path/to/response.json

import Replacer from './replacer'

const path = process.argv[2]
const file = Bun.file(path)
const data = await file.json()
const count = Replacer.transform(data, path)
const urls = count === 1 ? 'url' : 'urls'

console.log(`replaced ${count} ${urls} in ${path}`)
