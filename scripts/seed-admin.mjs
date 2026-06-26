#!/usr/bin/env node
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "wod";
const email = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
const password = process.env.ADMIN_PASSWORD || "";
const name = process.env.ADMIN_NAME || "Admin";

if (!uri) {
  console.error("MONGODB_URI não definida");
  process.exit(1);
}
if (!email || password.length < 8) {
  console.error("Defina ADMIN_EMAIL e ADMIN_PASSWORD (mínimo 8 caracteres)");
  process.exit(1);
}

const client = new MongoClient(uri);
try {
  await client.connect();
  const col = client.db(dbName).collection("users");
  const existing = await col.findOne({ email });
  if (existing) {
    console.log(`Usuário ${email} já existe. Nada a fazer.`);
    process.exit(0);
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await col.insertOne({ email, name, passwordHash, role: "admin", createdAt: new Date() });
  console.log(`Admin ${email} criado com sucesso.`);
} catch (err) {
  console.error("Falha ao criar admin:", err.message);
  process.exit(1);
} finally {
  await client.close();
}
