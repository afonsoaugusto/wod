#!/usr/bin/env node
/**
 * Cadastra (ou atualiza) o treino do dia para todos os alunos/grupos do coach.
 *
 * Uso:
 *   MONGODB_URI=... node scripts/seed-today-workout.mjs
 *   WORKOUT_ID=2026-07-28 SCHEDULED_FOR=2026-07-28 node scripts/seed-today-workout.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "wod";
const workoutId = process.env.WORKOUT_ID || "2026-07-28";
const scheduledFor =
  process.env.SCHEDULED_FOR ||
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

if (!uri) {
  console.error("MONGODB_URI não definida");
  process.exit(1);
}

const workoutPath = path.join(
  __dirname,
  "..",
  "public",
  "timer",
  "workouts",
  `${workoutId}.json`
);
if (!fs.existsSync(workoutPath)) {
  console.error(`Workout não encontrado: ${workoutPath}`);
  process.exit(1);
}

const workout = JSON.parse(fs.readFileSync(workoutPath, "utf8"));
const title = workout.name || workoutId;
const details = workout.description || null;
const config = workout.config || null;

const client = new MongoClient(uri);
try {
  await client.connect();
  const db = client.db(dbName);
  const users = db.collection("users");
  const groups = db.collection("groups");
  const assignments = db.collection("assignments");

  const coaches = await users
    .find({ role: { $in: ["admin", "coach"] } })
    .toArray();
  if (!coaches.length) {
    console.error("Nenhum coach/admin encontrado.");
    process.exit(1);
  }

  let created = 0;
  for (const coach of coaches) {
    const coachId = coach._id.toString();
    const students = await users
      .find({ role: "student", coachId })
      .toArray();
    const groupDocs = await groups.find({ coachId }).toArray();

    const targets = [
      ...groupDocs.map((g) => ({
        targetType: "group",
        targetId: g._id.toString(),
        label: g.name,
      })),
      ...students.map((s) => ({
        targetType: "student",
        targetId: s._id.toString(),
        label: s.name,
      })),
    ];

    if (!targets.length) {
      console.log(`Coach ${coach.email}: sem alunos/grupos.`);
      continue;
    }

    // Prefer group assignment when groups exist; otherwise assign per student.
    const preferred = groupDocs.length
      ? targets.filter((t) => t.targetType === "group")
      : targets;

    for (const t of preferred) {
      await assignments.deleteMany({
        coachId,
        targetType: t.targetType,
        targetId: t.targetId,
        scheduledFor,
        workoutId,
      });
      await assignments.insertOne({
        coachId,
        targetType: t.targetType,
        targetId: t.targetId,
        title,
        workoutId,
        config,
        details,
        scheduledFor,
        createdAt: new Date(),
      });
      created += 1;
      console.log(`✓ ${t.targetType} ${t.label} ← ${title} (${scheduledFor})`);
    }
  }

  console.log(`Pronto: ${created} associação(ões) criada(s).`);
} catch (err) {
  console.error("Falha:", err.message);
  process.exit(1);
} finally {
  await client.close();
}
