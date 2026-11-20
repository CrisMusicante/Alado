/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [__dirname + '/index.html', __dirname + '/src/**/*.{ts,tsx}', __dirname + '/../src/components/KeyBadge.tsx'],
  theme: { extend: { colors: { 'slate-750': '#293548' } } },
  plugins: [],
}
