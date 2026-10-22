// Starter programs. Exercises reference library slugs.
// Each entry: [slug, sets, repLow, repHigh, restSec, group?]
type Slot = [string, number, number, number, number, string?];

export type TemplateDay = {
  title: string;
  weekday: number | null;
  kind: "workout" | "rest";
  exercises: Slot[];
};

export type Template = {
  key: string;
  name: string;
  goal: string;
  level: string;
  description: string;
  daysPerWeek: number;
  days: TemplateDay[];
};

const rest = (weekday: number): TemplateDay => ({
  title: "Rest",
  weekday,
  kind: "rest",
  exercises: [],
});

export const TEMPLATES: Template[] = [
  {
    key: "ulppl",
    name: "5-Day ULPPL",
    goal: "Build muscle",
    level: "Intermediate",
    description: "Upper, Lower, Push, Pull, Lower. Each muscle twice a week.",
    daysPerWeek: 5,
    days: [
      {
        title: "Lower 2 · Glutes",
        weekday: 0,
        kind: "workout",
        exercises: [
          ["barbell-deadlift", 3, 6, 10, 180],
          ["bulgarian-split-squat-glute-focused", 3, 8, 12, 120],
          ["dumbbell-lying-leg-curls", 3, 10, 20, 90],
          ["seated-leg-extensions", 3, 10, 15, 90],
          ["hip-abduction-machine", 3, 10, 15, 90, "A"],
          ["seated-weighted-calf-raises", 3, 8, 12, 90, "A"],
        ],
      },
      {
        title: "Upper",
        weekday: 1,
        kind: "workout",
        exercises: [
          ["flat-dumbbell-press", 3, 8, 12, 120],
          ["chest-supported-machine-row", 3, 8, 12, 120],
          ["seated-dumbbell-shoulder-press", 2, 8, 12, 120],
          ["lat-pulldowns", 3, 8, 12, 90],
          ["incline-machine-chest-press", 3, 8, 12, 90],
          ["dumbbell-lateral-raises", 3, 10, 20, 60],
        ],
      },
      rest(2),
      {
        title: "Lower 1 · Quads",
        weekday: 3,
        kind: "workout",
        exercises: [
          ["smith-machine-squat", 3, 6, 10, 120],
          ["barbell-romanian-deadlift", 3, 8, 12, 120],
          ["walking-lunges-quad-focused", 3, 8, 12, 90],
          ["seated-leg-extensions", 3, 10, 15, 90],
          ["leg-press-calf-raises", 3, 10, 15, 120, "A"],
          ["dead-bug", 3, 5, 10, 120, "A"],
        ],
      },
      {
        title: "Push",
        weekday: 4,
        kind: "workout",
        exercises: [
          ["low-incline-dumbbell-press", 3, 8, 12, 120],
          ["pec-deck-machine-fly", 3, 10, 15, 90],
          ["chest-dips", 3, 10, 15, 90],
          ["lu-raises", 3, 10, 20, 60],
          ["tricep-bar-pushdowns", 3, 10, 15, 60],
          ["dumbbell-overhead-tricep-extensions", 3, 10, 15, 60],
        ],
      },
      rest(5),
      {
        title: "Pull",
        weekday: 6,
        kind: "workout",
        exercises: [
          ["pull-ups", 3, 6, 10, 120],
          ["lat-focused-cable-row", 3, 10, 15, 90],
          ["reverse-pec-deck", 3, 10, 15, 60],
          ["incline-dumbbell-curls", 3, 8, 12, 60],
          ["hammer-curls", 2, 8, 12, 60],
          ["standing-face-pulls", 2, 10, 15, 60],
        ],
      },
    ],
  },
  {
    key: "upper-lower",
    name: "4-Day Upper / Lower",
    goal: "Build muscle & strength",
    level: "Beginner–Intermediate",
    description: "Two upper and two lower days. Simple and very effective.",
    daysPerWeek: 4,
    days: [
      {
        title: "Upper A",
        weekday: 1,
        kind: "workout",
        exercises: [
          ["barbell-bench-press", 3, 6, 10, 150],
          ["chest-supported-machine-row", 3, 8, 12, 120],
          ["seated-dumbbell-shoulder-press", 3, 8, 12, 120],
          ["lat-pulldowns", 3, 8, 12, 90],
          ["dumbbell-lateral-raises", 3, 10, 20, 60, "A"],
          ["tricep-bar-pushdowns", 3, 10, 15, 60, "A"],
        ],
      },
      {
        title: "Lower A",
        weekday: 2,
        kind: "workout",
        exercises: [
          ["barbell-back-squat", 3, 6, 10, 180],
          ["barbell-romanian-deadlift", 3, 8, 12, 150],
          ["seated-leg-extensions", 3, 10, 15, 90],
          ["seated-leg-curls", 3, 10, 15, 90],
          ["leg-press-calf-raises", 3, 10, 15, 60],
        ],
      },
      rest(3),
      {
        title: "Upper B",
        weekday: 4,
        kind: "workout",
        exercises: [
          ["low-incline-dumbbell-press", 3, 8, 12, 120],
          ["pull-ups", 3, 6, 10, 120],
          ["pec-deck-machine-fly", 3, 10, 15, 90],
          ["lat-focused-cable-row", 3, 10, 15, 90],
          ["incline-dumbbell-curls", 3, 8, 12, 60, "A"],
          ["dumbbell-overhead-tricep-extensions", 3, 10, 15, 60, "A"],
        ],
      },
      {
        title: "Lower B",
        weekday: 5,
        kind: "workout",
        exercises: [
          ["barbell-deadlift", 3, 5, 8, 180],
          ["bulgarian-split-squat-glute-focused", 3, 8, 12, 120],
          ["barbell-hip-thrust", 3, 8, 12, 120],
          ["dumbbell-lying-leg-curls", 3, 10, 15, 90],
          ["hanging-leg-raises", 3, 10, 15, 60],
        ],
      },
      rest(6),
      rest(0),
    ],
  },
  {
    key: "full-body",
    name: "3-Day Full Body",
    goal: "Get strong, stay consistent",
    level: "Beginner",
    description: "Three full-body sessions. Perfect when time is tight.",
    daysPerWeek: 3,
    days: [
      {
        title: "Full Body A",
        weekday: 1,
        kind: "workout",
        exercises: [
          ["barbell-back-squat", 3, 6, 10, 180],
          ["flat-dumbbell-press", 3, 8, 12, 120],
          ["chest-supported-machine-row", 3, 8, 12, 120],
          ["dumbbell-lateral-raises", 2, 10, 20, 60],
          ["cable-crunches", 2, 10, 15, 60],
        ],
      },
      rest(2),
      {
        title: "Full Body B",
        weekday: 3,
        kind: "workout",
        exercises: [
          ["barbell-romanian-deadlift", 3, 8, 12, 150],
          ["seated-dumbbell-shoulder-press", 3, 8, 12, 120],
          ["lat-pulldowns", 3, 8, 12, 90],
          ["walking-lunges-quad-focused", 2, 8, 12, 90],
          ["hammer-curls", 2, 8, 12, 60],
        ],
      },
      rest(4),
      {
        title: "Full Body C",
        weekday: 5,
        kind: "workout",
        exercises: [
          ["barbell-hip-thrust", 3, 8, 12, 120],
          ["low-incline-dumbbell-press", 3, 8, 12, 120],
          ["lat-focused-cable-row", 3, 10, 15, 90],
          ["seated-leg-extensions", 2, 10, 15, 90],
          ["tricep-bar-pushdowns", 2, 10, 15, 60],
        ],
      },
      rest(6),
      rest(0),
    ],
  },
];
