# App Screen Slide Deck Source

This project generates a PowerPoint deck with one slide per app screen.
Each slide places the app screenshot on the left and the explanatory copy on the right.
The visual treatment follows the uploaded `design.md` direction: clean white canvas, near-black text, generous whitespace, rounded elements, and a single accent color.

## Files

- `src/create_app_screens_deck.js` — deck-generation source code
- `assets/07_일상일정_인증.png` — date/orientation task screenshot
- `assets/09_단어_연상_연습.png` — verbal-fluency task screenshot
- `design.md` — design reference used for the deck
- `output/` — generated PPTX output folder

## Run

```bash
npm install
npm run build
```

The generated deck will be saved to:

```text
output/app_screen_slides.pptx
```
