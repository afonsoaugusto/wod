import { type Collection, type ObjectId } from "mongodb";
import { getDb } from "./mongodb";

export type Role = "admin" | "coach" | "student";

export interface UserDoc {
  _id?: ObjectId;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  coachId?: string | null;
  /** Token público para abrir o treino no timer sem login (apenas alunos). */
  shareToken?: string;
  createdAt: Date;
}

export interface GroupDoc {
  _id?: ObjectId;
  name: string;
  coachId: string;
  studentIds: string[];
  createdAt: Date;
}

export type AssignmentTarget = "student" | "group";

export interface AssignmentDoc {
  _id?: ObjectId;
  coachId: string;
  targetType: AssignmentTarget;
  targetId: string;
  title: string;
  /** Optional reference to a classic workout id (public/timer/workouts/<id>.json). */
  workoutId?: string | null;
  /** Optional free-form workout description / planilha. */
  details?: string | null;
  scheduledFor?: string | null;
  createdAt: Date;
}

export async function users(): Promise<Collection<UserDoc>> {
  const db = await getDb();
  return db.collection<UserDoc>("users");
}

export async function groups(): Promise<Collection<GroupDoc>> {
  const db = await getDb();
  return db.collection<GroupDoc>("groups");
}

export async function assignments(): Promise<Collection<AssignmentDoc>> {
  const db = await getDb();
  return db.collection<AssignmentDoc>("assignments");
}
