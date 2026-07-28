import fs from "fs";
import path from "path";
import index from "@/public/timer/workouts/index.json";

export type WorkoutOption = {
  id: string;
  name: string;
  description?: string;
};

export function getWorkoutIds(): string[] {
  return (index as { workouts: string[] }).workouts ?? [];
}

export function getWorkoutOptions(): WorkoutOption[] {
  const dir = path.join(process.cwd(), "public", "timer", "workouts");
  return getWorkoutIds().map((id) => {
    try {
      const raw = fs.readFileSync(path.join(dir, `${id}.json`), "utf8");
      const data = JSON.parse(raw) as { name?: string; description?: string };
      return {
        id,
        name: data.name || id,
        description: data.description,
      };
    } catch {
      return { id, name: id };
    }
  });
}

export function getWorkoutConfig(id: string): Record<string, unknown> | null {
  try {
    const file = path.join(process.cwd(), "public", "timer", "workouts", `${id}.json`);
    const raw = fs.readFileSync(file, "utf8");
    const data = JSON.parse(raw) as { config?: Record<string, unknown> };
    return data.config ?? null;
  } catch {
    return null;
  }
}
