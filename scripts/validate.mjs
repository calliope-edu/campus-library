#!/usr/bin/env node
/**
 * Checks library.json against library.schema.json, then what a schema cannot
 * say: every id is unique across the whole file, and no section is empty.
 * CI runs this on every pull request.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const read = async (name) =>
	JSON.parse(await readFile(fileURLToPath(new URL(`../${name}`, import.meta.url)), 'utf8'));

const [schema, library] = await Promise.all([read('library.schema.json'), read('library.json')]);

const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

const problems = [];
if (!validate(library)) {
	for (const error of validate.errors) {
		problems.push(`${error.instancePath || '/'} ${error.message}`);
	}
}

const seen = new Set();
for (const section of library.sections || []) {
	for (const id of [section.id, ...(section.entries || []).map((entry) => entry.id)]) {
		if (seen.has(id)) problems.push(`id "${id}" is used twice`);
		seen.add(id);
	}
	if (!section.entries?.length) problems.push(`section "${section.id}" has no entries`);
}

if (problems.length) {
	console.error(`library.json is not valid:\n${problems.map((p) => `  ${p}`).join('\n')}`);
	process.exit(1);
}
const entries = library.sections.reduce((sum, section) => sum + section.entries.length, 0);
console.log(`library.json is valid: ${library.sections.length} sections, ${entries} entries.`);
