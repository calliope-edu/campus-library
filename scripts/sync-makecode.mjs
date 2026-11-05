#!/usr/bin/env node
/**
 * Reads the MakeCode galleries and the Arbeitsheft 2 tutorial repository
 * again and compares them with library.json.
 *
 *   node scripts/sync-makecode.mjs          report differences (exit 1 if any)
 *   node scripts/sync-makecode.mjs --write  also write them into library.json
 *
 * Only the sections listed in SOURCES are touched. In them, what the source
 * owns (url, imageUrl) is updated, while what we curate by hand
 * (title, label, grade, the order of entries) is kept. New entries get a
 * proposed title: check it before committing. Entries gone from the source
 * are removed. Every other section (Appcamps, …) is left alone.
 *
 * Node 18 or newer, no dependencies.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const LIBRARY = fileURLToPath(new URL('../library.json', import.meta.url));
const MAKECODE = 'https://makecode.calliope.cc';
const GALLERY_API = `${MAKECODE}/api/md/calliopemini`;
const AH2_REPO = 'calliope-edu/arbeitsheft2tutorials';

const SOURCES = [
	{
		section: { id: 'arbeitsheft-1', title: 'Arbeitsheft 1', order: 10 },
		read: () => readTutorialGallery('calliope/arbeitsheft', 'ah1', { nameIsLabel: true })
	},
	{
		section: { id: 'arbeitsheft-2', title: 'Arbeitsheft 2', order: 20 },
		read: readArbeitsheft2
	},
	{
		section: { id: 'tutorials', title: 'Tutorials', order: 30 },
		read: () => readTutorialGallery('calliope/tutorials', 'tutorial')
	},
	{
		section: { id: 'jacdac', title: 'Jacdac', order: 40 },
		read: readJacdac
	}
];

/** Fields the source owns; everything else in an entry is curated. */
const SOURCE_FIELDS = ['url', 'imageUrl'];

async function fetchText(url) {
	const response = await fetch(url, { headers: { 'user-agent': 'campus-library-sync' } });
	if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
	return response.text();
}

/** All ```codecard blocks of a gallery page, as one list of cards. */
async function readGallery(path) {
	const markdown = await fetchText(`${GALLERY_API}/${path}?lang=de`);
	const cards = [];
	for (const [, block] of markdown.matchAll(/```codecard\s*\n([\s\S]*?)```/g)) {
		cards.push(...JSON.parse(block));
	}
	return cards;
}

function slugToId(value) {
	return String(value)
		.toLowerCase()
		.replace(/ä/g, 'ae')
		.replace(/ö/g, 'oe')
		.replace(/ü/g, 'ue')
		.replace(/ß/g, 'ss')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

const UPPERCASE_WORDS = new Set(['led', 'rgb', 'usb']);

/** A title proposal from a slug such as `smart-licht` or `luftqualitaet`. */
function slugToTitle(slug) {
	return slug
		.split('-')
		.filter(Boolean)
		.map((word) => {
			if (UPPERCASE_WORDS.has(word)) return word.toUpperCase();
			const umlauts = word.replace(/ae/g, 'ä').replace(/oe/g, 'ö').replace(/ue/g, 'ü');
			return umlauts.charAt(0).toUpperCase() + umlauts.slice(1);
		})
		.join('-');
}

function httpsOrUndefined(url) {
	return typeof url === 'string' && url.startsWith('https://') ? url : undefined;
}

async function readTutorialGallery(path, idPrefix, { nameIsLabel = false } = {}) {
	const cards = await readGallery(path);
	return cards
		.filter((card) => card.cardType === 'tutorial' && String(card.url || '').startsWith('/'))
		.map((card) => {
			const slug = card.url.split('/').pop();
			// Arbeitsheft slugs read `18-4_led-matrix`: page and task, then the name.
			const name = slug.includes('_') ? slug.slice(slug.indexOf('_') + 1) : slug;
			return {
				id: `${idPrefix}-${slugToId(slug)}`,
				title: nameIsLabel ? slugToTitle(slugToId(name)) : card.name,
				editors: ['makecode'],
				kind: 'tutorial',
				url: `${MAKECODE}/#tutorial:${card.url}`,
				imageUrl: httpsOrUndefined(card.imageUrl),
				label: nameIsLabel ? card.name : undefined
			};
		});
}

async function listGithubDir(repo, dir) {
	const listing = JSON.parse(await fetchText(`https://api.github.com/repos/${repo}/contents/${dir}`));
	return listing.filter((item) => item.type === 'file' && item.name.endsWith('.md'));
}

/**
 * Arbeitsheft 2: one tutorial per file in `tutorials/`, the variant without
 * hints under the same name in `tutorials_nohints/`. The library holds one
 * version of each, the one without hints; a tutorial that has none keeps
 * the one with hints. The first heading reads `# 4.2 Reaktionsspiel`:
 * chapter number, then the title.
 */
async function readArbeitsheft2() {
	const [withHints, noHints] = await Promise.all([
		listGithubDir(AH2_REPO, 'tutorials'),
		listGithubDir(AH2_REPO, 'tutorials_nohints')
	]);
	const noHintNames = new Set(noHints.map((item) => item.name));
	const base = `${MAKECODE}/#tutorial:https://github.com/${AH2_REPO}`;

	const entries = [];
	for (const file of withHints) {
		const name = file.name.replace(/\.md$/, '');
		const markdown = await fetchText(file.download_url);
		const heading = (markdown.match(/^#\s+(.+)$/m) || [])[1] || name;
		const [, chapter = '', title = heading] = heading.match(/^([\d.]+)\s+(.*)$/) || [];
		entries.push({
			id: `ah2-${slugToId(name)}`,
			title: title.trim(),
			editors: ['makecode'],
			kind: 'tutorial',
			url: noHintNames.has(file.name)
				? `${base}/tutorials_nohints/${name}`
				: `${base}/tutorials/${name}`,
			label: chapter.replace(/\.$/, '') || undefined
		});
	}
	return entries;
}

/**
 * The Jacdac gallery links to sections of the Jacdac page on calliope.cc.
 * Each section there has a video and a "Programmcode" share link; the share
 * link is what Campus can open, so it becomes the entry. Cards whose section
 * has no share link (the overview) are skipped.
 */
async function readJacdac() {
	const cards = await readGallery('calliope/jacdac');
	const pages = new Map();
	const entries = [];
	for (const card of cards) {
		const [page, anchor] = String(card.url || '').split('#');
		if (!anchor) {
			console.warn(`jacdac: "${card.name}" links to a page, not a module; skipped`);
			continue;
		}
		if (!pages.has(page)) pages.set(page, await fetchText(page));
		const html = pages.get(page);
		const start = html.indexOf(`id="${anchor}"`);
		// The section runs until the next anchor, past the end of its own tag.
		const next = html.indexOf('class="anchor-target"', html.indexOf('>', start));
		const block = start < 0 ? '' : html.slice(start, next < 0 ? undefined : next);
		const program = (block.match(/https:\/\/makecode\.calliope\.cc\/_[A-Za-z0-9]+/) || [])[0];
		if (!program) {
			console.warn(`jacdac: no program link for "${card.name}"; skipped`);
			continue;
		}
		const box = (block.match(/<h3>\s*(StartBox [IV]+)/) || [])[1];
		entries.push({
			id: `jacdac-${slugToId(anchor)}`,
			title: card.name,
			editors: ['makecode'],
			kind: 'program',
			url: program,
			imageUrl: httpsOrUndefined(card.imageUrl),
			label: box
		});
	}
	return entries;
}

function withoutUndefined(entry) {
	return Object.fromEntries(Object.entries(entry).filter(([, value]) => value !== undefined));
}

function merge(section, fresh, report) {
	const freshById = new Map(fresh.map((entry) => [entry.id, withoutUndefined(entry)]));
	const kept = [];
	for (const entry of section.entries) {
		const source = freshById.get(entry.id);
		if (!source) {
			report.push(`- ${section.id}/${entry.id}: no longer in the source, removed`);
			continue;
		}
		freshById.delete(entry.id);
		const next = { ...entry };
		for (const field of SOURCE_FIELDS) {
			if (source[field] === entry[field]) continue;
			report.push(
				`~ ${section.id}/${entry.id}: ${field} ${entry[field] ?? '(none)'} -> ${source[field] ?? '(none)'}`
			);
			if (source[field] === undefined) delete next[field];
			else next[field] = source[field];
		}
		kept.push(next);
	}
	for (const entry of freshById.values()) {
		report.push(`+ ${section.id}/${entry.id}: new, "${entry.title}" (check the title)`);
		kept.push(entry);
	}
	section.entries = kept;
}

async function main() {
	const write = process.argv.includes('--write');
	const library = JSON.parse(await readFile(LIBRARY, 'utf8'));
	const report = [];

	for (const source of SOURCES) {
		let section = library.sections.find((candidate) => candidate.id === source.section.id);
		if (!section) {
			section = { ...source.section, entries: [] };
			library.sections.push(section);
			report.push(`+ section ${section.id}`);
		}
		merge(section, await source.read(), report);
	}

	library.sections.sort((a, b) => a.order - b.order);

	if (report.length === 0) {
		console.log('library.json is up to date with the galleries.');
		return;
	}
	console.log(report.join('\n'));
	if (write) {
		await writeFile(LIBRARY, `${JSON.stringify(library, null, '\t')}\n`);
		console.log(`\nWrote ${report.length} change(s) to library.json.`);
	} else {
		console.log('\nRun with --write to apply.');
		process.exitCode = 1;
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 2;
});
