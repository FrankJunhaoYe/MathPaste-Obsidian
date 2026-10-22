import { build } from 'esbuild';

// Bundle in memory so Node can run extensionless TS imports without writing another artifact.
const bundled = await build({
  entryPoints: ['src/converter.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'es2021',
  write: false,
  logLevel: 'silent',
});
const core = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`
);
const line = String.raw`paragraph \(x\) ` + '`code`\n\n';
for (const [name, text] of [
  ['10 KB mixed', line.repeat(400)],
  ['32 KB plain', ('a'.repeat(1000) + '\n').repeat(32) + String.raw`\(x\)`],
  ['1 MB mixed', line.repeat(42_000)],
  ['unclosed delimiters', (String.raw`\(` + '\n').repeat(2000)],
]) {
  const started = performance.now();
  const result = core.planConversion(text);
  console.log(
    JSON.stringify({
      name,
      length: text.length,
      status: result.status,
      convertedCount: result.convertedCount,
      elapsedMs: Math.round((performance.now() - started) * 100) / 100,
    }),
  );
}
