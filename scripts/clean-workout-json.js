#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "public", "timer", "workouts");

function cleanBlockList(blockList) {
  return (blockList || []).map(({ id, ...block }) => block);
}

for (const file of fs.readdirSync(dir)) {
  if (!file.endsWith(".json") || file.startsWith("_") || file === "index.json") continue;
  const filePath = path.join(dir, file);
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (data.config?.blockList) {
    data.config.blockList = cleanBlockList(data.config.blockList);
  }
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

console.log("Removed block ids from workout JSON files");
