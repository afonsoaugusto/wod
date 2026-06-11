#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "workouts");
const ids = fs
  .readdirSync(dir)
  .filter((file) => file.endsWith(".json") && !file.startsWith("_") && file !== "index.json")
  .map((file) => file.replace(/\.json$/, ""))
  .sort();

fs.writeFileSync(path.join(dir, "index.json"), `${JSON.stringify({ workouts: ids }, null, 2)}\n`);
console.log(`Updated index.json with ${ids.length} workouts`);
