import { defineConfig, presetIcons, presetUno, presetWebFonts } from "unocss";
import fs from "node:fs";

export default defineConfig({
  safelist: [
    "i-ph-trash",
    "i-ph-trash-fill",
    "i-ph-timer",
    "i-ph-calendar-plus",
    "i-ph-sun-dim",
    "i-ph-sun",
    "i-ph-cloud-moon",
    "i-ph-moon-stars",
    "i-ph-clock",
    "i-ph-star-fill",
    "i-ph-book-fill",
    "i-ph-barbell-fill",
    "i-ph-sneaker-fill",
    "i-ph-heart-fill",
    "i-ph-code-fill",
    "i-ph-palette-fill",
    "i-ph-music-notes-fill",
    "i-ph-money-fill",
    "i-ph-leaf-fill",
    "i-ph-graduation-cap-fill",
    "i-ph-game-controller-fill",
    "bg-[#7986cb]",
    "bg-[#33b679]",
    "bg-[#8e24aa]",
    "bg-[#e67c73]",
    "bg-[#f6c026]",
    "bg-[#f4511e]",
    "bg-[#039be5]",
    "bg-[#616161]",
    "bg-[#3f51b5]",
    "bg-[#0b8043]",
    "bg-[#d50000]",
    "text-[#7986cb]",
    "text-[#33b679]",
    "text-[#8e24aa]",
    "text-[#e67c73]",
    "text-[#f6c026]",
    "text-[#f4511e]",
    "text-[#039be5]",
    "text-[#616161]",
    "text-[#3f51b5]",
    "text-[#0b8043]",
    "text-[#d50000]",
  ],
  presets: [
    presetUno(),
    presetIcons({
      collections: {
        ph: () =>
          JSON.parse(
            fs.readFileSync(
              new URL(
                "node_modules/@iconify-json/ph/icons.json",
                import.meta.url,
              ),
              "utf-8",
            ),
          ),
      },
    }),
    presetWebFonts({
      provider: "google",
      fonts: {
        sans: "Inter",
      },
    }),
  ],
});
