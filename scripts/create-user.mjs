#!/usr/bin/env node
/**
 * Cadastra um usuário manualmente via CLI.
 *
 * Exemplos:
 *   MONGODB_URI=... npm run create-user -- --name "Ana" --email ana@box.com --password senha123 --role student
 *   MONGODB_URI=... npm run create-user -- --name "Coach" --email coach@box.com --password senha123 --role coach
 *   MONGODB_URI=... npm run create-user -- --name "Admin" --email admin@box.com --password senha123 --role admin
 *
 * Aluno vinculado a um coach (por email do coach):
 *   ... --role student --coach-email coach@box.com
 *
 * Variáveis de ambiente equivalentes (úteis sem flags):
 *   USER_NAME, USER_EMAIL, USER_PASSWORD, USER_ROLE, COACH_EMAIL, MONGODB_URI, MONGODB_DB
 */
import { randomBytes } from "crypto";
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";

const ROLES = new Set(["admin", "coach", "student"]);

function usage() {
  console.log(`Uso:
  npm run create-user -- --name <nome> --email <email> --password <senha> --role <admin|coach|student> [--coach-email <email>]

Opções:
  --name, -n          Nome completo (obrigatório)
  --email, -e         Email (obrigatório)
  --password, -p      Senha (mín. 6 caracteres)
  --role, -r          admin | coach | student (padrão: student)
  --coach-email, -c   Email do coach (obrigatório para student, se houver mais de um coach)
  --help, -h          Mostra esta ajuda

Env: MONGODB_URI (obrigatório), MONGODB_DB, USER_NAME, USER_EMAIL, USER_PASSWORD, USER_ROLE, COACH_EMAIL`);
}

function parseArgs(argv) {
  const out = {
    name: process.env.USER_NAME || "",
    email: process.env.USER_EMAIL || "",
    password: process.env.USER_PASSWORD || "",
    role: process.env.USER_ROLE || "student",
    coachEmail: process.env.COACH_EMAIL || "",
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i] ?? "";
    switch (a) {
      case "--help":
      case "-h":
        out.help = true;
        break;
      case "--name":
      case "-n":
        out.name = next();
        break;
      case "--email":
      case "-e":
        out.email = next();
        break;
      case "--password":
      case "-p":
        out.password = next();
        break;
      case "--role":
      case "-r":
        out.role = next();
        break;
      case "--coach-email":
      case "-c":
        out.coachEmail = next();
        break;
      default:
        if (a.startsWith("-")) {
          console.error(`Flag desconhecida: ${a}`);
          usage();
          process.exit(1);
        }
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  usage();
  process.exit(0);
}

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "wod";
const name = String(args.name || "").trim();
const email = String(args.email || "").toLowerCase().trim();
const password = String(args.password || "");
const role = String(args.role || "student").toLowerCase().trim();
const coachEmail = String(args.coachEmail || "").toLowerCase().trim();

if (!uri) {
  console.error("MONGODB_URI não definida");
  process.exit(1);
}
if (!name || !email || password.length < 6) {
  console.error("Informe --name, --email e --password (mínimo 6 caracteres).");
  usage();
  process.exit(1);
}
if (!ROLES.has(role)) {
  console.error(`Role inválida: ${role}. Use admin, coach ou student.`);
  process.exit(1);
}

const client = new MongoClient(uri);
try {
  await client.connect();
  const col = client.db(dbName).collection("users");

  const existing = await col.findOne({ email });
  if (existing) {
    console.error(`Email já cadastrado: ${email} (role=${existing.role})`);
    process.exit(1);
  }

  let coachId = null;
  if (role === "student") {
    const coaches = await col
      .find({ role: { $in: ["admin", "coach"] } })
      .toArray();

    if (coachEmail) {
      const coach = coaches.find((c) => c.email === coachEmail);
      if (!coach) {
        console.error(`Coach não encontrado: ${coachEmail}`);
        process.exit(1);
      }
      coachId = coach._id.toString();
    } else if (coaches.length === 1) {
      coachId = coaches[0]._id.toString();
      console.log(`Vinculando ao coach ${coaches[0].email}`);
    } else if (coaches.length === 0) {
      console.error("Nenhum coach/admin no banco. Crie um coach antes do aluno.");
      process.exit(1);
    } else {
      console.error(
        "Há vários coaches. Informe --coach-email com um destes:\n" +
          coaches.map((c) => `  - ${c.email} (${c.name})`).join("\n")
      );
      process.exit(1);
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const doc = {
    name,
    email,
    passwordHash,
    role,
    createdAt: new Date(),
  };

  if (role === "student") {
    doc.coachId = coachId;
    doc.shareToken = randomBytes(12).toString("hex");
  }

  const result = await col.insertOne(doc);
  console.log("Usuário criado:");
  console.log(`  id:    ${result.insertedId.toString()}`);
  console.log(`  nome:  ${name}`);
  console.log(`  email: ${email}`);
  console.log(`  role:  ${role}`);
  if (doc.shareToken) {
    console.log(`  link:  /timer?aluno=${doc.shareToken}`);
  }
} catch (err) {
  console.error("Falha ao criar usuário:", err.message);
  process.exit(1);
} finally {
  await client.close();
}
