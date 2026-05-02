# Plasmid Plinko

A roguelite Plinko run where every peg you clear is a base pair — collect A/T/G/C, climb the ante, and beat the sequencer bosses. A BioKEA game.

> **Status:** private beta. Public release pending.

![Plasmid Plinko gameplay](docs/screenshot.png)
<!-- TODO: drop a real screenshot or gif at docs/screenshot.png before going public -->

## The science angle

Every peg on the board is a nucleotide. Clearing pegs assembles A/T/G/C tallies the way a sequencer reads a strand, and bosses (`Promethion`, `Centrifuge`) are nods to real lab kit. Plasmid Plinko is part of [BioKEA](https://biokea.ai)'s effort to make the language of modern biology — sequencing, assembly, lab workflows — feel intuitive to anyone who can drop a ball.

## Play

- **Daily** — one seeded run, eight antes, share your score string.
- **Campaign** — branching map of standard / anomaly / lab / rest / boss nodes, four playable characters (biologist, alchemist, surgeon, …), upgrade picks between fights.

### Controls

- **Aim** — move the cursor.
- **Drop** — click / tap.
- **Powerups** — number keys (or the on-screen tray) when charges are available.
- **Mute** — corner toggle.

## Tech

- React 18 + TypeScript + Vite
- [matter-js](https://brm.io/matter-js/) for ball physics
- Tailwind + shadcn/radix for UI
- Supabase for the daily leaderboard (optional — set env vars below or it'll silently no-op)
- Bun as package manager and runtime

## Local dev

```bash
bun install
bun run dev      # http://localhost:5173
bun run build    # production build into dist/
```

Optional Supabase leaderboard:

```bash
cp .env.example .env   # then fill in:
# VITE_SUPABASE_URL=...
# VITE_SUPABASE_PUBLISHABLE_KEY=...
```

The app reads these via `import.meta.env`; no keys are committed.

## License

MIT — see [LICENSE](LICENSE).

---

Made by [BioKEA](https://biokea.ai).
