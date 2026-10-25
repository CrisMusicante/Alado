"""Genera resources/seed/ (DB + videos) a partir de la instalación local para
embeberla en el instalador. Uso: python scripts/make-seed.py"""
import os, shutil, sqlite3, sys

appdata = os.environ.get('APPDATA') or os.path.expanduser('~/Library/Application Support')
src = os.path.join(appdata, 'alado')
out = os.path.join(os.path.dirname(__file__), '..', 'resources', 'seed')
shutil.rmtree(out, ignore_errors=True)
os.makedirs(out)

dest_db = os.path.join(out, 'worshipflow.seed.db')
con = sqlite3.connect(f"file:{os.path.join(src, 'worshipflow.db')}?mode=ro", uri=True)
con.execute(f"VACUUM INTO '{dest_db}'")
con.close()

# Limpia estado local que no debe viajar
con = sqlite3.connect(dest_db)
con.execute("DELETE FROM app_settings WHERE key = 'last_backup'")
con.commit()
con.execute('VACUUM')
n = con.execute('SELECT COUNT(*) FROM songs').fetchone()[0]
con.close()

shutil.copytree(os.path.join(src, 'videos'), os.path.join(out, 'videos'))
print(f'Semilla lista: {n} canciones, {len(os.listdir(os.path.join(out, "videos")))} videos -> {os.path.normpath(out)}')
