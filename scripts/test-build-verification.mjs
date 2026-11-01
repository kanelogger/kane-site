import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const verifier = fileURLToPath(new URL('./verify-build.mjs', import.meta.url));
const fixture = await mkdtemp(join(tmpdir(), 'kane-build-verification-'));
try {
  await cp('dist', join(fixture, 'dist'), { recursive: true });
  await mkdir(join(fixture, 'src'));
  await cp('src/content', join(fixture, 'src/content'), { recursive: true });
  const index = join(fixture, 'dist/index.html');
  const html = await readFile(index, 'utf8');
  assert(html.includes('</body>'), 'Expected a complete built index.html');
  const run = () => spawnSync(process.execPath, [verifier], { cwd: fixture, encoding: 'utf8', timeout: 30000 });
  let result = run();
  assert.equal(result.status, 0, result.stderr);
  console.log('PASS: isolated copy of current build passes verification');

  for (const [label, injection, expected] of [
    ['broken link', '<a href="/agent-test-missing-route">fixture</a>', 'missing /agent-test-missing-route'],
    ['missing alt', '<img src="/favicon.svg" width="1000" height="1000">', 'image needs alt and dimensions'],
    ['missing image', '<img src="/assets/agent-test-missing.webp" alt="fixture" width="1" height="1">', 'missing /assets/agent-test-missing.webp'],
  ]) {
    await writeFile(index, html.replace('</body>', `${injection}</body>`));
    result = run();
    assert.equal(result.status, 1, `${label} must fail; ${result.stderr}`);
    assert(result.stderr.includes(expected), result.stderr);
    console.log(`PASS: ${label} is rejected by the build verifier`);
  }
  await writeFile(index, html);
  for (const route of ['index.html', 'en/index.html']) {
    const path = join(fixture, 'dist', route);
    const source = await readFile(path, 'utf8');
    for (const injection of ['<dialog data-entrance></dialog>', '<button data-entrance-replay>Replay intro</button>']) {
      await writeFile(path, source.replace('</body>', `${injection}</body>`));
      result = run();
      assert.equal(result.status, 1, `${route}: entrance UI must fail; ${result.stderr}`);
      assert(result.stderr.includes('home must not include entrance UI'), result.stderr);
      await writeFile(path, source);
    }
    console.log(`PASS: ${route} rejects entrance dialog and replay control`);
  }
  for (const route of ['index.html', 'en/index.html']) {
    const path = join(fixture, 'dist', route);
    const source = await readFile(path, 'utf8');
    const prefix = route.startsWith('en/') ? '/en' : '';
    for (const [label, mutate, expected] of [
      ['missing introduction paragraph', (html) => html.replace(/(<div\b[^>]*class="hero-statement"[^>]*>)\s*<p\b[^>]*>[\s\S]*?<\/p>/, '$1'), 'home introduction must retain four readable paragraphs'],
      ['unlinked introduction keyword', (html) => html.replace(`href="${prefix}/writing/agent-hard-gates"`, 'href="#work"'), `missing introduction link ${prefix}/writing/agent-hard-gates`],
      ['missing contact navigation', (html) => html.replace('href="#contact"', 'href="#notes"'), 'missing workshop navigation contact'],
      ['old about section', (html) => html.replace('</main>', '<section id="about"></section></main>'), 'old about section must be removed'],
      ['redundant footer contacts', (html) => html.replace('</footer>', '<div class="footer-top"></div></footer>'), 'redundant footer contact block must be removed'],
      ['missing contact destination', (html) => html.replace('href="https://weibo.com/u/2272877934"', 'href="https://weibo.com/"'), 'missing contact destination https://weibo.com/u/2272877934'],
      ['JavaScript-only WeChat contact', (html) => html.replace(/<summary\b[^>]*>[\s\S]*?GeekGuru[\s\S]*?<\/summary>/, ''), 'WeChat contact must work without JavaScript'],
      ['missing WeChat QR', (html) => html.replace(/<img\b[^>]*src="\/assets\/contact\/[^"]+"[^>]*>/, ''), 'WeChat contact needs a local QR image'],
    ]) {
      const mutated = mutate(source);
      assert.notEqual(mutated, source, `${route}: ${label} mutation must change fixture`);
      await writeFile(path, mutated);
      result = run();
      assert.equal(result.status, 1, `${route}: ${label} must fail; ${result.stderr}`);
      assert(result.stderr.includes(expected), result.stderr);
      await writeFile(path, source);
      console.log(`PASS: ${route} rejects ${label}`);
    }
  }
  for (const route of ['index.html', 'en/index.html']) {
    const path = join(fixture, 'dist', route);
    const source = await readFile(path, 'utf8');
    for (const [label, from, to, expected] of [
      ['apps link', 'class="apps-link"', 'class="removed-apps-link"', 'missing home apps link'],
      ['language switch', 'class="language-switch"', 'class="removed-language-switch"', 'missing home language switch'],
      ['workshop layout', 'data-workshop-home', 'data-old-home', 'home must use the workshop layout'],
    ]) {
      assert(source.includes(from), `${route}: fixture must contain ${from}`);
      await writeFile(path, source.replace(from, to));
      result = run();
      assert.equal(result.status, 1, `${route}: missing ${label} must fail; ${result.stderr}`);
      assert(result.stderr.includes(expected), result.stderr);
      await writeFile(path, source);
      console.log(`PASS: ${route} rejects missing ${label}`);
    }
  }
  const projectPath = join(fixture, 'dist/work/kane-skills/index.html');
  const projectHtml = await readFile(projectPath, 'utf8');
  const projectCover = projectHtml.match(/<meta property="og:image" content="https:\/\/kanelogger.com([^"]+)"/)[1];
  const projectCoverPath = join(fixture, 'dist', projectCover);
  const projectCoverBytes = await readFile(projectCoverPath);
  await writeFile(projectCoverPath, Buffer.concat([projectCoverBytes, Buffer.from('changed')]));
  result = run();
  assert.equal(result.status, 1, `changed cover without a new filename must fail; ${result.stderr}`);
  assert(result.stderr.includes('cover filename must match its content fingerprint'), result.stderr);
  await writeFile(projectCoverPath, projectCoverBytes);
  console.log('PASS: cover content changes require a new fingerprinted filename');

  for (const [label, from, to, expected] of [
    ['project share fallback', /(<meta property="og:image" content=")[^"]+/, '$1https://kanelogger.com/og.png', 'Twitter and OG images must match'],
    ['missing project cover', /<figure[^>]+class="project-detail-cover"[^>]*>[\s\S]*?<\/figure>/, '', 'project must display its cover exactly once'],
  ]) {
    assert.notEqual(projectHtml.replace(from, to), projectHtml, `${label}: mutation must change fixture`);
    await writeFile(projectPath, projectHtml.replace(from, to));
    result = run();
    assert.equal(result.status, 1, `${label} must fail; ${result.stderr}`);
    assert(result.stderr.includes(expected), result.stderr);
    await writeFile(projectPath, projectHtml);
    console.log(`PASS: ${label} is rejected`);
  }
  const articlePath = join(fixture, 'dist/writing/agent-hard-gates/index.html');
  const articleHtml = await readFile(articlePath, 'utf8');
  for (const [label, from, to, expected] of [
    ['article share fallback', /(<meta property="og:image" content=")[^"]+/, '$1https://kanelogger.com/og.png', 'Twitter and OG images must match'],
    ['wrong share dimensions', /(<meta property="og:image:height" content=")900/, '$1630', '900'],
    ['missing article cover', /<img[^>]+class="article-cover-image"[^>]*>/, '', 'article must display its cover exactly once'],
  ]) {
    assert.notEqual(articleHtml.replace(from, to), articleHtml, `${label}: mutation must change fixture`);
    await writeFile(articlePath, articleHtml.replace(from, to));
    result = run();
    assert.equal(result.status, 1, `${label} must fail; ${result.stderr}`);
    assert(result.stderr.includes(expected), result.stderr);
    console.log(`PASS: ${label} is rejected`);
  }
  await writeFile(articlePath, articleHtml.replace(/<script type="application\/ld\+json">[^<]+<\/script>/, ''));
  result = run();
  assert.equal(result.status, 1, `missing article data must fail; ${result.stderr}`);
  assert(result.stderr.includes('missing article structured data'), result.stderr);
  console.log('PASS: missing article structured data is rejected by the build verifier');
} finally {
  await rm(fixture, { recursive: true, force: true });
}
