# Calliope Campus library

The curated library that [Calliope Campus](https://campus.calliope.cc) shows in its import dialog, under "Bibliothek": tutorials, programs and teaching material, grouped in sections. A click on an entry starts it in the room: a tutorial or program becomes a program of its own, a video, PDF or board becomes an embedded material.

Campus loads [`library.json`](library.json) from this repository's `main` branch, so a merged pull request reaches every Campus within minutes. Campus keeps the last copy it loaded and ships a copy of its own for when GitHub cannot be reached.

## Adding an entry

1. Fork this repository and edit `library.json`.
2. Add the entry to a section's `entries`, or add a section.
3. Run `npm install && npm run validate`, or let the check on the pull request do it.
4. Open a pull request that says what the material is and who it is for.

An entry:

```json
{
	"id": "ah2-4-2-reaktionsspiel",
	"title": "Reaktionsspiel",
	"editors": ["makecode"],
	"kind": "tutorial",
	"url": "https://makecode.calliope.cc/#tutorial:https://github.com/calliope-edu/arbeitsheft2tutorials/tutorials_nohints/4.2_reaktionsspiel",
	"imageUrl": "https://…/cover.png",
	"label": "4.2",
	"grade": { "from": 5, "to": 7 }
}
```

| Field      | Required | Meaning                                                                                                                                                                                                                                                                                        |
| ---------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`       | yes      | Lowercase words joined by `-`, unique in the whole file. Never rename or reuse one: rooms will refer to entries by id.                                                                                                                                                                         |
| `title`    | yes      | Shown on the tile. Short; the label carries the chapter or page.                                                                                                                                                                                                                               |
| `editors`  | no       | The Campus editors the entry is made for, a list: `makecode`, `python`, `blocks`, `umo`, `iot`, `arcade`. A room shows the entry when at least one of them is switched on. `[]` or missing for material that needs no editor (videos, PDFs, boards); that shows in every room.                 |
| `kind`     | yes      | `tutorial`, `program`, `video`, `pdf` or `embed`.                                                                                                                                                                                                                                              |
| `url`      | yes      | `https://` only. MakeCode tutorials as `https://makecode.calliope.cc/#tutorial:…`, programs as share links (`https://makecode.calliope.cc/_…`). Videos, PDFs and boards must come from a host Campus embeds. One version per entry: a tutorial with and without hints is listed without hints. |
| `imageUrl` | no       | Cover image, shown square. Without one the tile shows the label.                                                                                                                                                                                                                               |
| `label`    | no       | Short reference such as `S. 18 Aufg. 4` or `4.2`.                                                                                                                                                                                                                                              |
| `grade`    | no       | School years, `{ "from": 5, "to": 7 }`.                                                                                                                                                                                                                                                        |

A section has an `id`, a `title`, an `order` (ascending; leave gaps of 10 so new sections fit in between) and its `entries`. Material from a provider outside Calliope gets the provider's `logoUrl`, shown beside the title, and `link`, the provider's page the logo opens; keep the logo in [`images/`](images). [`library.schema.json`](library.schema.json) is the full format.

Images and embedded material are loaded by pupils' browsers from a Campus page, so Campus only accepts hosts on its allow-list. A new host needs a change in Campus too (`src/lib/services/embeds/allowlist.ts`).

## Keeping the MakeCode sections current

The sections Arbeitsheft 1, Arbeitsheft 2, Tutorials and Jacdac come from the MakeCode galleries and the [arbeitsheft2tutorials](https://github.com/calliope-edu/arbeitsheft2tutorials) repository. To compare them with `library.json`:

```sh
npm run sync             # list what changed
npm run sync -- --write  # write it into library.json
```

The script updates addresses and images, adds new entries with a proposed title and removes entries that are gone. Titles, labels and order stay as curated here: check the proposed titles before committing.
