import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  buildPgnMentorPlayerPlan,
  buildLichessBroadcastPlan,
  buildTwicPlan,
  discoverPgnMentorPlayersFromHtml,
  filterPendingDownloads,
  parseTwicDownloadLink,
  sourcePathForUrl
} from '../tools/player-prep/public-source-downloader.mjs';

function tempRoot() {
  return mkdtempSync(join(tmpdir(), 'chessprep-downloads-'));
}

test('buildLichessBroadcastPlan orders monthly sources newest first', () => {
  const plan = buildLichessBroadcastPlan({
    from: '2021-11',
    to: '2022-02',
    baseUrl: 'https://example.test'
  });

  assert.deepEqual(plan.map((item) => item.id), [
    'lichess-broadcast-2022-02',
    'lichess-broadcast-2022-01',
    'lichess-broadcast-2021-12',
    'lichess-broadcast-2021-11'
  ]);
  assert.equal(plan[0].url, 'https://example.test/lichess_db_broadcast_2022-02.pgn.zst');
});

test('buildLichessBroadcastPlan uses the official broadcast directory by default', () => {
  const [item] = buildLichessBroadcastPlan({ from: '2025-11', to: '2025-11' });

  assert.equal(
    item.url,
    'https://database.lichess.org/broadcast/lichess_db_broadcast_2025-11.pgn.zst'
  );
});

test('buildTwicPlan orders weekly sources newest first', () => {
  const plan = buildTwicPlan({
    firstIssue: 1500,
    latestIssue: 1503,
    baseUrl: 'https://example.test'
  });

  assert.deepEqual(plan.map((item) => item.id), [
    'twic-1503',
    'twic-1502',
    'twic-1501',
    'twic-1500'
  ]);
  assert.equal(plan[0].url, 'https://example.test/zips/twic1503g.zip');
});

test('buildTwicPlan starts at the oldest consistently downloadable TWIC zip by default', () => {
  const plan = buildTwicPlan({ latestIssue: 922 });

  assert.deepEqual(plan.map((item) => item.id), ['twic-922', 'twic-921', 'twic-920']);
});

test('parseTwicDownloadLink resolves old issue html download links', () => {
  const html = `
    <a href="../zips/twic900g.zip">PGN</a>
    <a href="/html/twic900.html">Issue</a>
  `;

  assert.equal(
    parseTwicDownloadLink(html, 'https://theweekinchess.com/html/twic900.html'),
    'https://theweekinchess.com/zips/twic900g.zip'
  );
});

test('filterPendingDownloads skips sources already downloaded', () => {
  const root = tempRoot();
  try {
    const existing = {
      id: 'twic-1503',
      url: 'https://example.test/zips/twic1503g.zip',
      targetDir: join(root, 'twic')
    };
    const missing = {
      id: 'twic-1502',
      url: 'https://example.test/zips/twic1502g.zip',
      targetDir: join(root, 'twic')
    };
    mkdirSync(existing.targetDir, { recursive: true });
    writeFileSync(sourcePathForUrl(existing), 'already here', 'utf8');

    const pending = filterPendingDownloads([existing, missing]);

    assert.deepEqual(pending.map((item) => item.id), ['twic-1502']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('discoverPgnMentorPlayersFromHtml handles current zip player links', () => {
  const html = `
    <tr><td><a href="players/Ding.zip">Ding.pgn</a></td><td>Ding Liren, 2116 games</td></tr>
    <tr><td><a href="players/Wei.zip">Wei.pgn</a></td><td>Wei Yi, 1806 games</td></tr>
    <tr><td><a href="players/Abdusattorov/"></a></td><td>View only</td></tr>
  `;

  assert.deepEqual(discoverPgnMentorPlayersFromHtml(html), ['Ding', 'Wei']);
});

test('buildPgnMentorPlayerPlan downloads player zip archives and extracts pgn names', () => {
  const root = tempRoot();
  try {
    const [item] = buildPgnMentorPlayerPlan(['Ding'], {
      baseUrl: 'https://example.test/players',
      targetDir: root
    });

    assert.equal(item.url, 'https://example.test/players/Ding.zip');
    assert.equal(item.expectedPgnName, 'Ding.pgn');
    assert.match(sourcePathForUrl(item), /Ding\.pgn$/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
