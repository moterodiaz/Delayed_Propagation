// Stationed flights waiting to depart KMIA/KFLL. When the Kingston-FIR TFR activates,
// they can no longer take off -> grounded. 15 are the real casualty callsigns; the rest
// pad the apron for visual density (matching the feed's "~42 routes affected").
export interface GroundedFlight {
  id: string;
  airport: "KMIA" | "KFLL";
  lat: number;
  lng: number;
  real: boolean;
}

const APT: Record<"KMIA" | "KFLL", [number, number]> = {
  KMIA: [25.795, -80.287],
  KFLL: [26.072, -80.152],
};

// real casualty callsigns + their arrival field (San Juan one omitted from apron view)
const REAL: { id: string; airport: "KMIA" | "KFLL" }[] = [
  { id: "AAL367", airport: "KMIA" }, { id: "DAL1790", airport: "KMIA" },
  { id: "AAL2231", airport: "KMIA" }, { id: "AAL1128", airport: "KMIA" },
  { id: "AAL920", airport: "KMIA" }, { id: "DAL1328", airport: "KMIA" },
  { id: "AAL914", airport: "KMIA" }, { id: "AAL1102", airport: "KMIA" },
  { id: "AAL2987", airport: "KMIA" }, { id: "AAL1812", airport: "KMIA" },
  { id: "DAL1295", airport: "KFLL" }, { id: "JBU575", airport: "KFLL" },
  { id: "JBU2694", airport: "KFLL" }, { id: "JBU238", airport: "KMIA" },
];

const AIRLINES = ["AAL", "DAL", "JBU", "NKS", "SWA", "UAL"];

// deterministic apron jitter (no Math.random — keeps SSR + determinism stable)
function jitter(i: number): [number, number] {
  const a = (i * 47) % 360;
  const r = 0.04 + ((i * 13) % 7) * 0.012;
  return [r * Math.cos((a * Math.PI) / 180), r * Math.sin((a * Math.PI) / 180)];
}

export const GROUNDED_FLIGHTS: GroundedFlight[] = (() => {
  const out: GroundedFlight[] = [];
  REAL.forEach((f, i) => {
    const [blat, blng] = APT[f.airport];
    const [dy, dx] = jitter(i);
    out.push({ id: f.id, airport: f.airport, lat: blat + dy, lng: blng + dx, real: true });
  });
  // pad to ~42
  for (let i = 0; i < 28; i++) {
    const airport: "KMIA" | "KFLL" = i % 3 === 0 ? "KFLL" : "KMIA";
    const [blat, blng] = APT[airport];
    const [dy, dx] = jitter(i + 17);
    const code = AIRLINES[i % AIRLINES.length];
    out.push({ id: `${code}${1000 + i * 7}`, airport, lat: blat + dy, lng: blng + dx, real: false });
  }
  return out;
})();
