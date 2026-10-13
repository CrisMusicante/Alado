// Stand-in for `python -m demucs` in tests: same CLI shape, tqdm progress on stderr,
// and the htdemucs/<track>/{vocals,no_vocals}.wav output layout.
const fs = require('fs')
const path = require('path')

const args = process.argv.slice(2)
const outRoot = args[args.indexOf('-o') + 1]
const input = args[args.length - 1]

if (process.env.FAKE_DEMUCS_FAIL === '1') {
  process.stderr.write('Traceback (most recent call last):\nRuntimeError: Could not load file ' + input + '\n')
  process.exit(1)
}
if (process.env.FAKE_DEMUCS_REQUIRE_WAV === '1' && !input.endsWith('.wav')) {
  process.stderr.write('LoadAudioError: FFmpeg is not installed.\n')
  process.exit(1)
}
if (!fs.existsSync(input)) {
  process.stderr.write('FileNotFoundError: ' + input + '\n')
  process.exit(1)
}

for (const pct of [0, 25, 50, 75, 100]) process.stderr.write(` ${pct}%|█ | ${pct}/100 [00:01<00:01]\r`)

const track = path.parse(input).name
const dir = path.join(outRoot, 'htdemucs', track)
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(path.join(dir, 'vocals.wav'), 'VOCALS')
fs.writeFileSync(path.join(dir, 'no_vocals.wav'), 'INSTRUMENTAL')

if (process.env.FAKE_DEMUCS_HANG === '1') setInterval(() => {}, 1000)
