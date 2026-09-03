# The Legend of Shu, a Nut Between the Worlds

A small browser game inspired by *The Legend of Zelda: Tears of the Kingdom*
(a world torn into two realms, a hero who fell from the sky, a shattered
tyrant to confront) rendered in a *Deltarune*-style presentation: top-down
pixel exploration with an Undertale/Deltarune-style FIGHT / ACT / SPARE
bullet-dodging battle system — plus a real multiplayer server with accounts,
a shared world, chat commands, and moderation tools.

Everything (sprites, tiles, UI) is drawn with plain Canvas 2D from code —
no external art assets.

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
- Back (in menus) / Leave multiplayer: `X`, `Shift`, or `Escape`
- Chat / commands (multiplayer): `Enter` to open the chat box, `Enter` again to send

## Single Player vs. Multiplayer

From the title screen, choose:

- **Single Player** — the story campaign described above, exactly as before.
- **Multiplayer** — log in or sign up, then explore one shared world
  together with every other connected player in real time.

## Multiplayer accounts, roles & commands

Signing up with the email **`nihankalra2015@gmail.com`** automatically
grants the **OWNER** badge (gold, shown next to that player's name). Every
other sign-up starts as a regular player.

Roles, low to high: **PLAYER** (no badge) → **ADMIN** (red badge) →
**MANAGER** (orange badge) → **OWNER** (gold badge, permanent, exactly one).
Whoever can act on a role can act on everyone below it, never at or above:
an admin can moderate players; a manager can moderate players *and* admins;
only the owner can touch a manager, and nobody can touch the owner.

Anyone can use:
- `/tpa <player>` — send a friendly teleport request to another player
- `/tpaccept` / `/tpdeny` — accept or decline the most recent request sent to you
- `/shop` — see what gold buys; `/shop buy <key|lantern>` to purchase
- `/list <key|lantern> <price>` — put an item you own up for auction
- `/ah` — browse auction listings; `/ah buy <id>`; `/ah cancel <id>` on your own listing
- `/help` — list the commands available to your role

**ADMIN, MANAGER, and OWNER** can also use:
- `/tp <player>` — teleport straight to a player, no request needed
- `/eco give <player> <amount>` / `/eco take <player> <amount>` — grant or remove gold (never below 0)
- `/ban <player> [reason]` — ban a player permanently
- `/tempban <player> <time> [reason]` — ban temporarily, e.g. `/tempban Alex 2h griefing` (`s`/`m`/`h`/`d` units)
- `/pardon <player>` — remove a player's ban

The **OWNER** can additionally use:
- `/op <player>` — promote a player to **ADMIN**
- `/op <player> manager` — promote a player to **MANAGER**
- `/deop <player>` — demote an admin or manager back to a regular player

Gold, inventory (Acorn Keys, Husk Lanterns), roles, and bans are stored
server-side in `server/data/users.json` (passwords are salted and hashed,
never stored in plain text) and persist across restarts. Keys and lanterns
bought or won at auction are real, consumable items — spending one at the
chasm or the Sundered Throne's door in the shared multiplayer world uses it
up, same as the single-player campaign's item flags but tracked server-side
so it can't be spoofed by the client.

## Run it locally

The combined server serves the game **and** powers multiplayer (accounts,
the shared world, chat/commands) over one port:

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`. Single Player works immediately;
Multiplayer will sign up/log in and connect to this same server.

If you only want the static single-player build with no server at all:
`npm run static` (serves the files as-is; the Multiplayer option won't
be able to reach a server in that mode).

## Deploying

The game has two parts with different hosting needs:

- **The client** (`index.html`, `style.css`, `src/`) is static and works
  fine on Vercel — `vercel.json` is already set up for it (no build step).
- **The multiplayer server** (`server/`) is a stateful Node process (it
  holds WebSocket connections and an in-memory session table), which
  doesn't fit Vercel's serverless model. Deploy `server/server.js` to a
  host that runs a persistent Node process — e.g. Render, Railway, Fly.io,
  or a small VPS — where it will serve the game *and* the multiplayer API
  from one URL, which is the simplest setup.

If you deploy the client and the multiplayer server to different domains,
point the client at your server with a URL query param:
`https://your-game.vercel.app/?server=https://your-server.example.com`.

### Deploy to Vercel (client, or the whole app if you skip multiplayer)

```bash
npm i -g vercel   # if you don't have it yet
vercel            # first deploy, follow the prompts
vercel --prod     # promote to production
```

Or connect the GitHub repo to a new Vercel project from the dashboard for
automatic deploys on every push.

## Project structure

```
index.html            entry point / canvas / auth & chat overlays
style.css              page chrome, overlay & chat styling
src/sprites.js         procedural pixel-art sprites (no image files)
src/maps.js            tile maps, NPCs, chests, transitions
src/dialogue.js        textbox system + all dialogue script
src/battle.js          FIGHT / ACT / SPARE battle system + bullet patterns
src/story.js           flags/inventory + dialogue-triggered story actions
src/auth-ui.js          sign-up/log-in overlay + session handling
src/multiplayer.js      WebSocket client + chat UI
src/main.js             input, game state machine, rendering, loop

server/server.js       HTTP + WebSocket server, REST auth endpoints, map-transition gating
server/store.js         user accounts (hashing, roles, bans, gold, inventory, auction listings), JSON-file persisted
server/auth.js          session tokens
server/world.js         online-player registry (per-map), ban-status checks
server/worldmaps.js     server-side copy of map transitions, for validating item-gated crossings
server/commands.js      /tpa, /tp, /ban, /tempban, /pardon, /op, /deop, /eco, /shop, /list, /ah, /help
```
