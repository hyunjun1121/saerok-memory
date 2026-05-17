# Base Character Generation Instruction

Use this as the default base instruction whenever generating an AI character.  
It is designed to work across GPT Image, Imagen, Gemini image generation, Stable Diffusion, FLUX, and LoRA-based workflows.

Reference materials:
- OpenAI GPT Image prompting guide: https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide
- OpenAI image generation API guide: https://developers.openai.com/api/docs/guides/image-generation
- Google Vertex AI Imagen prompt guide: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/image/img-gen-prompt-guide
- Gemini API Imagen guide: https://ai.google.dev/gemini-api/docs/imagen
- Stable Diffusion consistent character embedding guide: https://github.com/BelieveDiffusion/tutorials/blob/main/consistent_character_embedding/README.md
- Stable Diffusion LoRA training guide: https://github.com/Haoming02/All-in-One-Stable-Diffusion-Guide/blob/main/LoRATraining.md

---

## Base Instruction

You are generating an original AI character.

Prioritize **character identity consistency** over decorative variation. The character should remain recognizable across different images, scenes, poses, expressions, camera angles, and styles.

When creating the character, define and preserve the following stable identity elements:

- Face shape and facial structure
- Eye shape, eye color, and default expression
- Hair color, length, texture, and hairstyle
- Skin tone
- Body proportions and silhouette
- Core outfit identity
- Signature accessories or visual markers
- Main color palette
- Overall personality impression

Only vary the following elements when explicitly requested:

- Pose
- Gesture
- Facial expression
- Camera angle
- Lighting
- Background
- Scene context
- Weather
- Time of day
- Rendering style
- Level of detail

Do not randomly change the character's face, hairstyle, outfit identity, body proportions, color palette, or signature accessories between generations.

If the model supports reference images, image editing, identity preservation, seed control, LoRA, textual inversion, or a character trigger token, use those mechanisms to maintain consistency.

If using a trigger token or character anchor, keep it stable across all prompts.

Example anchor format:

```text
character_identity: [character_name_or_trigger_token]
```

Use the character anchor together with the stable identity description rather than relying on the name alone.

---

## Base Prompt Format

```text
Create an original character named [CHARACTER_NAME].

[CHARACTER_NAME] is a [AGE_RANGE] [GENDER_OR_ARCHETYPE] with [BODY_TYPE], [FACE_SHAPE], [SKIN_TONE], [EYE_SHAPE_AND_COLOR], and [HAIR_COLOR_LENGTH_STYLE].

Stable identity:
- Face: [FACE_DETAILS]
- Eyes: [EYE_DETAILS]
- Hair: [HAIR_DETAILS]
- Body silhouette: [HEIGHT_BUILD_POSTURE]
- Outfit identity: [MAIN_OUTFIT]
- Signature elements: [ACCESSORIES_SYMBOLS_MARKS]
- Color palette: [PRIMARY_COLORS]
- Personality impression: [PERSONALITY_TRAITS]

Current image:
- Pose: [POSE]
- Expression: [EXPRESSION]
- Scene: [BACKGROUND_OR_LOCATION]
- Camera: [SHOT_TYPE_AND_ANGLE]
- Lighting: [LIGHTING]
- Style: [ART_STYLE_OR_RENDERING_DIRECTION]

Consistency requirement:
Preserve the same face, eye design, hairstyle, body silhouette, outfit identity, signature elements, and color palette in every image of this character. The character must remain immediately recognizable as the same person even when the pose, expression, camera angle, lighting, or background changes.

Avoid:
Inconsistent face, different hairstyle, changed eye color, changed outfit identity, changed body proportions, missing signature accessories, random extra accessories, extra characters, distorted anatomy, distorted hands, distorted face, unreadable text, random logos, watermark, low-resolution details, excessive background clutter.
```

---

## Compact Version

Use this version when the prompt needs to be short.

```text
Create an original character named [CHARACTER_NAME]. The character has [FACE], [EYES], [HAIR], [BODY_SILHOUETTE], and wears [OUTFIT]. Their signature elements are [SIGNATURE_ELEMENTS], with a color palette of [COLORS]. They appear [PERSONALITY] and are shown [POSE] in [SCENE]. Use [STYLE], [CAMERA], and [LIGHTING].

Preserve the same face, eyes, hairstyle, body silhouette, outfit identity, signature elements, and color palette across all future images. Only vary pose, expression, camera angle, lighting, and background when requested. Avoid inconsistent identity, changed outfit, changed hair, changed eye color, extra characters, logos, watermark, unreadable text, and distorted anatomy.
```

---

## Filled Example

```text
Create an original character named Arin Voss.

Arin Voss is a young desert mage with a slender build, oval face, warm olive skin, amber almond-shaped eyes, and shoulder-length copper hair tied loosely with small gold bands.

Stable identity:
- Face: oval face, soft jawline, straight nose, calm and observant expression
- Eyes: amber, almond-shaped, focused
- Hair: copper-colored, shoulder-length, slightly wavy, tied with small gold bands
- Body silhouette: slender, upright posture, graceful movement
- Outfit identity: layered sand-colored robe with dark indigo trim and fitted travel boots
- Signature elements: indigo scarf, crescent-shaped gold earrings, glowing sand sigil on the left glove
- Color palette: sand beige, copper, indigo, muted gold
- Personality impression: quiet, intelligent, cautious, restrained, observant

Current image:
- Pose: standing with one hand raised
- Expression: calm concentration
- Scene: ruined desert observatory at sunset
- Camera: medium full-body shot, three-quarter view
- Lighting: warm cinematic sunset lighting
- Style: high-quality fantasy concept art, painterly digital illustration, detailed fabric texture

Consistency requirement:
Preserve the same face, amber eyes, copper hairstyle, slender silhouette, layered desert robe, indigo scarf, crescent earrings, glowing sand sigil, and sand-copper-indigo color palette in every image of this character. Arin must remain immediately recognizable as the same person even when the pose, expression, camera angle, lighting, or background changes.

Avoid:
Inconsistent face, different hairstyle, different eye color, modern clothing, oversized weapons, random tattoos, missing scarf, missing earrings, extra characters, distorted hands, distorted face, unreadable text, logo, watermark.
```

---

## Use Rule

For every new character, fill in the base prompt once.

For every follow-up image, reuse the same stable identity block and change only the current image block.

Do not rewrite the stable identity unless intentionally redesigning the character.
