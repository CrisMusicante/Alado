// Stand-in for ffmpeg in tests: `-i <in> ... <out>` copies the input bytes to <out>.
const fs = require('fs')

const args = process.argv.slice(2)
const input = args[args.indexOf('-i') + 1]
const output = args[args.length - 1]
if (process.env.FAKE_FFMPEG_FAIL === '1' || !fs.existsSync(input)) {
  process.stderr.write(input + ': Invalid data found when processing input\n')
  process.exit(1)
}
fs.writeFileSync(output, fs.readFileSync(input))
