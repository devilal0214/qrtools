export type FrameStyle = "none" | "soft-card" | "dark-badge" | "outline-tag";

export type PatternStyle =
  | "classic"
  | "rounded"
  | "thin"
  | "smooth"
  | "circles";

export type QRSettings = {
  size: number;
  bgColor: string;
  squaresColor: string;
  pixelsColor: string;
  patternStyle: PatternStyle;
  frameStyle: FrameStyle;
  logoPreset: "scan-me" | "camera" | null;
  logoImage: string | null;

  outerMargin: number;
  removeWatermark: boolean;
  removeAds: boolean;
  trackGps: boolean;
};

export const DEFAULT_SETTINGS: QRSettings = {
  size: 256,
  bgColor: "#ffffff",
  squaresColor: "#000000",
  pixelsColor: "#000000",
  patternStyle: "classic",
  frameStyle: "none",
  logoPreset: null,
  logoImage: null,

  outerMargin: 8,
  removeWatermark: false,
  removeAds: false,
  trackGps: false,
};

export const DEFAULT_TEMPLATES: Array<{
  id: string;
  name: string;
  settings: Partial<QRSettings>;
}> = [
  {
    id: "classic_black",
    name: "Classic",
    settings: {
      bgColor: "#ffffff",
      squaresColor: "#000000",
      pixelsColor: "#000000",
      patternStyle: "classic",
      frameStyle: "none",
      outerMargin: 8,
      logoPreset: null,
    },
  },
  {
    id: "rounded_soft",
    name: "Rounded",
    settings: {
      bgColor: "#ffffff",
      squaresColor: "#111827",
      pixelsColor: "#111827",
      patternStyle: "rounded",
      frameStyle: "soft-card",
      outerMargin: 10,
      logoPreset: "scan-me",
    },
  },
  {
    id: "color_pop",
    name: "Color Pop",
    settings: {
      bgColor: "#ffffff",
      squaresColor: "#7c3aed",
      pixelsColor: "#ec4899",
      patternStyle: "smooth",
      frameStyle: "outline-tag",
      outerMargin: 12,
      logoPreset: null,
    },
  },
  {
    id: "dark_badge",
    name: "Dark Badge",
    settings: {
      bgColor: "#ffffff",
      squaresColor: "#000000",
      pixelsColor: "#000000",
      patternStyle: "classic",
      frameStyle: "dark-badge",
      outerMargin: 10,
      logoPreset: "camera",
    },
  },
];
