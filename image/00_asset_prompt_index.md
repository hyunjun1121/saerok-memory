# Haru Image Prompt Index

This folder contains independent GPT Image 2 prompts. Each `.md` file is self-contained and can be pasted into a separate image-generation chat without relying on any other file.

## Product Context

Haru is a warm daily memory and cognitive routine app for older Korean and Japanese adults. It supports short, low-pressure activities such as number patterns, drawing practice, delayed word recall, personal story recall, language expression activities, garden rewards, and optional family/caregiver connection. The product must feel like a gentle daily routine, not a medical diagnosis tool.

## Global Style Direction

- Mood: warm, gentle, calm, accessible, encouraging, non-medical
- Theme: one small daily routine helps memories grow like a garden
- Palette: warm cream, paper ivory, sage green, deep leaf green, soft coral, warm sun yellow, muted sky blue, dark ink brown
- Rendering: original polished 2D mobile app illustration, clean vector-like shapes, rounded forms, crisp edges, subtle tactile depth
- Accessibility: simple silhouettes, large readable shapes, low clutter, older-adult friendly contrast
- Avoid globally: Duolingo-like bird or owl, copied trademark assets, hospital imagery, diagnostic charts, medical claims, fake text, watermark, cluttered backgrounds

## Prompt Files

1. `01_haru_sprout_mascot_identity.md`
   - Canonical Haru seedling mascot.

2. `02_haru_mascot_pose_sheet.md`
   - Six-pose mascot sheet for UI feedback and guidance.

3. `03_haru_app_icon_primary.md`
   - Text-free primary app icon.

4. `04_haru_logo_korean_hangul.md`
   - Korean Hangul wordmark using the exact text `하루`.

5. `05_haru_logo_japanese_hiragana.md`
   - Japanese hiragana wordmark using the exact text `はる`.

6. `06_haru_logo_japanese_kanji.md`
   - Japanese kanji symbol logo using the exact text `春`.

7. `07_haru_memory_bloom_symbol.md`
   - Text-free memory flower symbol.

8. `08_haru_water_drop_reward_icon.md`
   - Text-free water drop reward icon.

9. `09_haru_garden_reward_scene.md`
   - Garden reward illustration for result/garden screens.

10. `10_haru_cognitive_routine_icons.md`
    - Six lesson-node icons.

11. `11_haru_family_connection_illustration.md`
    - Family/caregiver connection illustration.

12. `12_haru_soft_background_pattern.md`
    - Seamless soft background pattern.

## Recommended Generation Order

1. Generate `01_haru_sprout_mascot_identity.md` first.
2. Use the best mascot result as a visual reference when generating `02_haru_mascot_pose_sheet.md`.
3. Generate logo files separately: `04`, `05`, and `06`. Do not merge scripts in one prompt.
4. Generate text-free icons and scene assets: `03`, `07`, `08`, `09`, `10`, `11`, and `12`.

## Logo Text Notes

Because image models can distort text, each logo prompt specifies exactly one text string. Use one prompt at a time:

- Korean app/logo surface: `하루`
- Japanese hiragana app/logo surface: `はる`
- Japanese kanji symbol or seal surface: `春`

Do not ask one generation to include Korean, Japanese, and English text together.
