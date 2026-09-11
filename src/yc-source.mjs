import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const DIRECTORY = 'https://www.ycombinator.com/companies';
const INDEX = 'YCCompany_production';

async function getResponse(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Public YC directory request failed (${response.status})`);
  return response;
}

/**
 * Fetch the public YC directory's exact batch and free-text search scopes.
 * The search credential is published in the directory HTML, is restricted to
 * public YC company indexes, and stays in memory. It is never written or logged.
 * `query=ai` is full-text/prefix search, not a claim that a company is an AI company.
 */
export async function fetchYCCohort({ batch = 'Spring 2026', query = 'ai' } = {}) {
  if (typeof batch !== 'string' || !batch.trim()) throw new Error('A nonempty batch is required');
  if (typeof query !== 'string') throw new Error('Query must be a string');
  const directoryURL = new URL(DIRECTORY);
  directoryURL.searchParams.set('batch', batch);
  directoryURL.searchParams.set('query', query);
  const html = await (await getResponse(directoryURL)).text();
  const match = html.match(/window\.AlgoliaOpts\s*=\s*(\{[^;]+\});/);
  if (!match) throw new Error('The public directory no longer exposes its search configuration');
  const config = JSON.parse(match[1]);
  if (!/^[A-Z0-9]+$/.test(config.app) || typeof config.key !== 'string') {
    throw new Error('Unexpected public directory search configuration');
  }
  const endpoint = `https://${config.app.toLowerCase()}-dsn.algolia.net/1/indexes/${INDEX}/query`;
  const filters = `batch:${JSON.stringify(batch)}`;
  async function searchAll(searchQuery) {
    const hits = [];
    let page = 0;
    let total = 0;
    let pages = 1;
    do {
      const response = await getResponse(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Algolia-Application-Id': config.app,
          'X-Algolia-API-Key': config.key,
        },
        body: JSON.stringify({
          query: searchQuery, filters, page, hitsPerPage: 1000,
          attributesToHighlight: [], analytics: false,
        }),
      });
      const data = await response.json();
      if (!Array.isArray(data.hits) || !Number.isInteger(data.nbHits)) {
        throw new Error('Unexpected public directory search result');
      }
      if (page && total !== data.nbHits) throw new Error('YC directory changed during pagination; rerun');
      total = data.nbHits;
      pages = data.nbPages;
      hits.push(...data.hits);
      page += 1;
    } while (page < pages);
    const unique = [...new Map(hits.map(hit => [String(hit.objectID), hit])).values()];
    if (unique.length !== total) throw new Error(`Incomplete public YC result: ${unique.length} of ${total}`);
    if (unique.some(hit => hit.batch !== batch)) throw new Error('YC returned a company outside the requested batch');
    return { total, hits: unique };
  }
  const results = await Promise.allSettled([searchAll(''), searchAll(query)]);
  for (const result of results) if (result.status === 'rejected') throw result.reason;
  const [full, selected] = results.map(result => result.value);
  const selectedIDs = new Set(selected.hits.map(hit => String(hit.objectID)));
  const fullIDs = new Set(full.hits.map(hit => String(hit.objectID)));
  if ([...selectedIDs].some(id => !fullIDs.has(id))) {
    throw new Error('YC directory changed between batch and query requests; rerun');
  }
  return {
    source: directoryURL.href,
    retrieved_at: new Date().toISOString(),
    batch, query,
    total: full.total,
    ai_query_total: selected.total,
    query_total: selected.total,
    source_metadata: {
      directory_url: directoryURL.href,
      index: INDEX,
      public_directory_only: true,
      query_semantics: 'YC directory general full-text/prefix search, not an AI-company classification. Literal AI in company name is a separate case-insensitive whole-word test.',
      completeness: 'All currently public directory records in this batch; not undisclosed or unlaunched batch members.',
    },
    full_batch_ids: [...fullIDs],
    ai_query_ids: [...selectedIDs],
    query_ids: [...selectedIDs],
    items: full.hits.map(hit => ({
      name: hit.name,
      yc_url: `${DIRECTORY}/${hit.slug || hit.id}`,
      website: hit.website || null,
      batch: hit.batch,
      one_liner: hit.one_liner || '',
      tags: hit.tags || [],
      id: hit.id,
      objectID: String(hit.objectID),
      matches_ai_query: selectedIDs.has(String(hit.objectID)),
      matches_query: selectedIDs.has(String(hit.objectID)),
      literal_ai_in_name: /\bai\b/i.test(hit.name),
    })),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const options = {};
  let output;
  for (let index = 2; index < process.argv.length; index += 2) {
    const flag = process.argv[index];
    const value = process.argv[index + 1];
    if (!value || !['--batch', '--query', '--output'].includes(flag)) {
      throw new Error('Usage: node src/yc-source.mjs [--batch "Spring 2026"] [--query ai] [--output path.json]');
    }
    if (flag === '--output') output = resolve(value);
    else options[flag.slice(2)] = value;
  }
  const cohort = await fetchYCCohort(options);
  const json = `${JSON.stringify(cohort, null, 2)}\n`;
  if (output) {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, json);
    console.log(`${cohort.total} public ${cohort.batch} companies; ${cohort.query_total} match query ${JSON.stringify(cohort.query)}. Wrote ${output}`);
  } else process.stdout.write(json);
}
