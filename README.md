# The Legend of Shu, a Nut Between the Worlds

A small browser game inspired by *The Legend of Zelda: Tears of the Kingdom*
(a world torn into two realms, a hero who fell from the sky, a shattered
tyrant to confront) rendered in a *Deltarune*-style presentation: top-down
pixel exploration with an Undertale/Deltarune-style FIGHT / ACT / SPARE
bullet-dodging battle system.

No build step, no external art assets — everything (sprites, tiles, UI) is
drawn with plain Canvas 2D from code, so it runs anywhere a static file can
be served.

## Story

Shu, a small acorn-shaped hero, wakes with no memory of how they fell from
the sky the day the world was torn in two: the **Canopy** above and the
**Hollow** below, split apart by the **Withered King** when he tried to
seize both at once. Shu descends through the chasm, gathers what's needed
to reach the Sundered Throne, and finally chooses how to end things with
the King — by force, or by reminding him what a whole world was worth.

## Controls

- Move: Arrow Keys or WASD
- Confirm / Interact / Advance text: `Z` or `Enter`
- Back (in menus): `X`, `Shift`, or `Escape`

## Run it locally

No dependencies to install — any static file server works:

```bash
npm run dev
# or simply:
npx serve .
# or:
python3 -m http.server 3000
```

Then open the printed local URL (e.g. `http://localhost:3000`) in a browser.

## Deploy to Vercel

This is a static site (`index.html` at the root), so Vercel needs no build
command — `vercel.json` already sets `buildCommand: null`.

```bash
npm i -g vercel   # if you don't have it yet
vercel            # first deploy, follow the prompts
vercel --prod     # promote to production
```

Or connect the GitHub repo to a new Vercel project from the Vercel
dashboard and it will deploy automatically on every push.

## Project structure

```
index.html          entry point / canvas
style.css           page chrome
src/sprites.js       procedural pixel-art sprites (no image files)
src/maps.js          tile maps, NPCs, chests, transitions
src/dialogue.js      textbox system + all dialogue script
src/battle.js        FIGHT / ACT / SPARE battle system + bullet patterns
src/story.js         flags/inventory + dialogue-triggered story actions
src/main.js          input, game state machine, overworld rendering, loop
```
