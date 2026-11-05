import { memo, type ReactElement } from "react";

/**
 * Original pixel-art icons drawn from character grids.
 * Each char maps to an --icon-* palette token; "." is transparent.
 */
const ICONS = {
  tickets: [
    "...kkkkkk...",
    "..kyyyyyyk..",
    ".kkkkkkkkkk.",
    ".kwwwwwwwwk.",
    ".kwkkkkkwwk.",
    ".kwwwwwwwwk.",
    ".kwkkkkkkwk.",
    ".kwwwwwwwwk.",
    ".kwkkkwwwwk.",
    ".kwwwwwggwk.",
    ".kwwwwwggwk.",
    ".kkkkkkkkkk.",
  ],
  editor: [
    "kkkkkkkkkkkk",
    "knnnnnnnnnnk",
    "knncnnnnpnnk",
    "kncnnnnynpnk",
    "kcnnnnnynnpk",
    "kncnnnynnpnk",
    "knncnnynpnnk",
    "knnnnnnnnnnk",
    "kkkkkkkkkkkk",
    "....kddk....",
    "..kkkkkkkk..",
    "..kllllllk..",
  ],
  chat: [
    "............",
    ".kkkkkkkkk..",
    "kcccccccccck",
    "kcwwcwwwccck",
    "kcccccccccck",
    "kcwwwwcwwcck",
    "kcccccccccck",
    ".kkkccckkkk.",
    "...kcck.kkkk",
    "...kck.kppppk",
    "...kk..kpwpk",
    ".......kkkk.",
  ],
  progress: [
    "..kkkkkkkk..",
    "kkkywyyyykkk",
    "kykywyyyykyk",
    "kykywyyyykyk",
    ".kkyyyyyykk.",
    "..kyyyyyyk..",
    "...kyyyyk...",
    "....kook....",
    ".....kk.....",
    "....kook....",
    "..kkkkkkkk..",
    "..kppppppk..",
  ],
  settings: [
    "....kkkk....",
    ".kk.kllk.kk.",
    ".klkkllkklk.",
    "..kllllllk..",
    "kkkllkkllkkk",
    "klllk..kdllk",
    "klllk..kdllk",
    "kkkllkkllkkk",
    "..kllddllk..",
    ".klkkllkklk.",
    ".kk.kllk.kk.",
    "....kkkk....",
  ],
  terminal: [
    "kkkkkkkkkkkk",
    "kdddddddrygk",
    "kkkkkkkkkkkk",
    "knnnnnnnnnnk",
    "kngnnnnnnnnk",
    "knngnnnnnnnk",
    "knnngnnnnnnk",
    "knngnnnnnnnk",
    "kngnnngggnnk",
    "knnnnnnnnnnk",
    "kkkkkkkkkkkk",
    "............",
  ],
  explorer: [
    "............",
    ".kkkkk......",
    "kyyyyykkkkk.",
    "kyyyyyyyyyyk",
    "kkkkkkkkkkkk",
    "koyyyyyyyyyk",
    "koyyyyyyyyyk",
    "koyyyyyyyyyk",
    "koyyyyyyyyyk",
    "kooooooooook",
    "kkkkkkkkkkkk",
    "............",
  ],
  start: [
    "kkkkk..kkkkk",
    "kcccck.kpppk",
    "kcccck.kpppk",
    "kcccck.kpppk",
    "kkkkkk.kkkkk",
    "............",
    "kkkkk..kkkkk",
    "kgggk..kyyyk",
    "kgggk..kyyyk",
    "kgggk..kyyyk",
    "kkkkk..kkkkk",
    "............",
  ],
  bell: [
    ".....kk.....",
    "....kyyk....",
    "...kyyyyk...",
    "..kyywyyyk..",
    "..kywyyyyk..",
    "..kyyyyyyk..",
    "..kyyyyyyk..",
    ".kyyyyyyyyk.",
    "kkkkkkkkkkkk",
    "....kook....",
    ".....kk.....",
    "............",
  ],
  lock: [
    "............",
    "....kkkk....",
    "...kllllk...",
    "..kl.kk.lk..",
    "..kl....lk..",
    ".kkkkkkkkkk.",
    ".kyyyyyyyyk.",
    ".kyyykkyyyk.",
    ".kyyykkyyyk.",
    ".kyyyyyyyyk.",
    ".kkkkkkkkkk.",
    "............",
  ],
  check: [
    "............",
    "..........kk",
    ".........kgk",
    "........kgk.",
    ".kk....kgk..",
    "kgk...kgk...",
    ".kgk.kgk....",
    "..kgkgk.....",
    "...kgk......",
    "....k.......",
    "............",
    "............",
  ],
  star: [
    ".....kk.....",
    "....kyyk....",
    "....kyyk....",
    "kkkkkyykkkkk",
    "kyyyywyyyyyk",
    ".kyyywyyyyk.",
    "..kyyyyyyk..",
    "..kyyyyyyk..",
    ".kyyykkyyyk.",
    ".kyykk.kyyk.",
    "kkkk....kkkk",
    "............",
  ],
  play: [
    "..kk........",
    "..kgkk......",
    "..kggkk.....",
    "..kgwggkk...",
    "..kgwgggkk..",
    "..kggggggk..",
    "..kggggggk..",
    "..kgggggkk..",
    "..kggggkk...",
    "..kggkk.....",
    "..kgkk......",
    "..kk........",
  ],
} as const;

export type IconName = keyof typeof ICONS;

interface Props {
  name: IconName;
  size?: number;
  className?: string;
  title?: string;
}

export const PixelIcon = memo(function PixelIcon({ name, size = 32, className, title }: Props) {
  const grid = ICONS[name];
  const rects: ReactElement[] = [];
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === ".") continue;
      rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={`var(--icon-${ch})`} />);
    }
  });
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      shapeRendering="crispEdges"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {rects}
    </svg>
  );
});

/** 8x8 pixel avatar; hair/shirt color varies per member. */
const AVATAR = [
  "..hhhh..",
  ".hhhhhh.",
  ".hssssh.",
  ".skssks.",
  ".ssssss.",
  "..skks..",
  ".cccccc.",
  "cccccccc",
];

export function PixelAvatar({ color, size = 32, label }: { color: "cyan" | "purple" | "green" | "yellow"; size?: number; label: string }) {
  const shirt = { cyan: "c", purple: "p", green: "g", yellow: "y" }[color];
  const hair = { cyan: "k", purple: "o", green: "n", yellow: "r" }[color];
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges" role="img" aria-label={label}>
      <rect x={0} y={0} width={8} height={8} fill="var(--icon-b)" />
      {AVATAR.map((row, y) =>
        row.split("").map((ch, x) => {
          if (ch === ".") return null;
          const token = ch === "h" ? hair : ch === "c" ? shirt : ch;
          return <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={`var(--icon-${token})`} />;
        }),
      )}
    </svg>
  );
}

/** Tiny 7x7 window control glyphs */
const CONTROLS = {
  minimize: [".......", ".......", ".......", ".......", ".......", "kkkkkk.", "kkkkkk."],
  maximize: ["kkkkkkk", "kkkkkkk", "k.....k", "k.....k", "k.....k", "k.....k", "kkkkkkk"],
  restore: ["..kkkkk", "..kkkkk", "kkkkk.k", "kkkkk.k", "k...kkk", "k...k..", "kkkkk.."],
  close: ["kk...kk", ".kk.kk.", "..kkk..", "..kkk..", ".kk.kk.", "kk...kk", "......."],
} as const;

export function ControlGlyph({ name }: { name: keyof typeof CONTROLS }) {
  return (
    <svg width={14} height={14} viewBox="0 0 7 7" shapeRendering="crispEdges" aria-hidden>
      {CONTROLS[name].map((row, y) =>
        row.split("").map((ch, x) => (ch === "k" ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="currentColor" /> : null)),
      )}
    </svg>
  );
}
