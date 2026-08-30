/**
 * Reserved village plots. These stay claimed by stub founders so the city
 * has a core; leftover plots stay open for players.
 */
export const DEMO_PLOTS: readonly {
  plotId: string;
  userId: string;
  displayName: string;
  mrrCents: number;
  isMrrPublic: boolean;
}[] = [
  { plotId: "plot-3", userId: "demo-ada", displayName: "Ada", mrrCents: 0, isMrrPublic: false },
  { plotId: "plot-4", userId: "demo-jun", displayName: "Jun", mrrCents: 8_500, isMrrPublic: false },
  { plotId: "plot-5", userId: "demo-ira", displayName: "Ira", mrrCents: 42_000, isMrrPublic: true },
  { plotId: "plot-6", userId: "demo-sol", displayName: "Sol", mrrCents: 18_000, isMrrPublic: false },
  { plotId: "plot-7", userId: "demo-nia", displayName: "Nia", mrrCents: 95_000, isMrrPublic: false },
  { plotId: "plot-8", userId: "demo-lin", displayName: "Lin", mrrCents: 10_000, isMrrPublic: false },
  { plotId: "plot-9", userId: "demo-oak", displayName: "Oak", mrrCents: 220_000, isMrrPublic: true },
  { plotId: "plot-10", userId: "demo-val", displayName: "Val", mrrCents: 75_000, isMrrPublic: false },
  { plotId: "plot-13", userId: "demo-kai", displayName: "Kai", mrrCents: 100_000, isMrrPublic: true },
  { plotId: "plot-18", userId: "demo-noor", displayName: "Noor", mrrCents: 500_000, isMrrPublic: false },
  { plotId: "plot-23", userId: "demo-remy", displayName: "Remy", mrrCents: 2_000_000, isMrrPublic: true },
  { plotId: "plot-28", userId: "demo-suki", displayName: "Suki", mrrCents: 5_000_000, isMrrPublic: false },
];

export const RESERVED_PLOT_IDS: readonly string[] = DEMO_PLOTS.map((d) => d.plotId);
