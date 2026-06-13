import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        // ── Surfaces (dark mode first, light mode via CSS var swap) ──────────
        surface: {
          0: "var(--surface-0)",   // app bg
          1: "var(--surface-1)",   // card bg
          2: "var(--surface-2)",   // elevated card / input
          3: "var(--surface-3)",   // tooltip / popover
        },
        // ── Borders ──────────────────────────────────────────────────────────
        border: {
          subtle: "var(--border-subtle)",
          DEFAULT: "var(--border-default)",
          strong:  "var(--border-strong)",
        },
        // ── Text ─────────────────────────────────────────────────────────────
        content: {
          primary:   "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted:     "var(--text-muted)",
          disabled:  "var(--text-disabled)",
          inverse:   "var(--text-inverse)",
        },
        // ── Brand ─────────────────────────────────────────────────────────────
        accent: {
          DEFAULT: "#4F6BFF",
          hover:   "#3D59E8",
          subtle:  "rgba(79,107,255,0.12)",
          border:  "rgba(79,107,255,0.35)",
        },
        // ── Semantic ──────────────────────────────────────────────────────────
        success: {
          DEFAULT: "#22C55E",
          muted:   "#16A34A",
          subtle:  "rgba(34,197,94,0.12)",
          border:  "rgba(34,197,94,0.35)",
        },
        warning: {
          DEFAULT: "#F59E0B",
          muted:   "#D97706",
          subtle:  "rgba(245,158,11,0.12)",
          border:  "rgba(245,158,11,0.35)",
        },
        danger: {
          DEFAULT: "#EF4444",
          muted:   "#DC2626",
          subtle:  "rgba(239,68,68,0.12)",
          border:  "rgba(239,68,68,0.35)",
        },
        security: {
          DEFAULT: "#8B5CF6",
          muted:   "#7C3AED",
          subtle:  "rgba(139,92,246,0.12)",
          border:  "rgba(139,92,246,0.35)",
        },
        // ── KPI card tints ────────────────────────────────────────────────────
        kpi: {
          blue:   "rgba(79,107,255,0.08)",
          green:  "rgba(34,197,94,0.08)",
          amber:  "rgba(245,158,11,0.08)",
          red:    "rgba(239,68,68,0.08)",
          purple: "rgba(139,92,246,0.08)",
        },
      },
      // ── Sidebar / layout dimensions ────────────────────────────────────────
      width: {
        sidebar: "240px",
        "sidebar-collapsed": "60px",
      },
      height: {
        topnav: "56px",
      },
      // ── Box shadows ────────────────────────────────────────────────────────
      boxShadow: {
        card:    "0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)",
        "card-md": "0 4px 12px rgba(0,0,0,0.5)",
        "card-lg": "0 8px 24px rgba(0,0,0,0.6)",
        glow:    "0 0 16px rgba(79,107,255,0.25)",
        "glow-danger": "0 0 16px rgba(239,68,68,0.25)",
      },
      // ── Border radius ─────────────────────────────────────────────────────
      borderRadius: {
        xs:  "2px",
        sm:  "4px",
        DEFAULT: "6px",
        md:  "8px",
        lg:  "12px",
        xl:  "16px",
      },
      // ── Animations ────────────────────────────────────────────────────────
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.4" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-left": {
          from: { opacity: "0", transform: "translateX(-8px)" },
          to:   { opacity: "1", transform: "translateX(0)" },
        },
        "scan-line": {
          "0%":   { backgroundPosition: "0% 0%" },
          "100%": { backgroundPosition: "0% 100%" },
        },
      },
      animation: {
        "pulse-dot":    "pulse-dot 2s ease-in-out infinite",
        "fade-in":      "fade-in 0.2s ease-out",
        "slide-left":   "slide-in-left 0.2s ease-out",
      },
      // ── Typography ────────────────────────────────────────────────────────
      fontSize: {
        "2xs": ["10px", { lineHeight: "14px", letterSpacing: "0.04em" }],
        xs:    ["11px", { lineHeight: "16px" }],
        sm:    ["12px", { lineHeight: "18px" }],
        base:  ["13px", { lineHeight: "20px" }],
        md:    ["14px", { lineHeight: "22px" }],
        lg:    ["15px", { lineHeight: "24px" }],
        xl:    ["16px", { lineHeight: "26px" }],
        "2xl": ["18px", { lineHeight: "28px" }],
        "3xl": ["20px", { lineHeight: "30px" }],
        "4xl": ["24px", { lineHeight: "32px" }],
        "5xl": ["28px", { lineHeight: "36px" }],
        "6xl": ["32px", { lineHeight: "40px" }],
      },
    },
  },
  plugins: [],
};

export default config;
