import type { Config } from "tailwindcss";
const config: Config = { content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"], theme: { extend: { colors: { violet: "#7657FF", lavender: "#A78BFA", blush: "#FF78A8", canvas: "#F8F7FC", ink: "#191627" } } }, plugins: [] };
export default config;
