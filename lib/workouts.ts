import index from "@/public/timer/workouts/index.json";

export function getWorkoutIds(): string[] {
  return (index as { workouts: string[] }).workouts ?? [];
}
