import psycopg2

conn = psycopg2.connect(dbname='az3d_db', user='postgres', password='mjsa25091996', host='localhost', port='5432')
cur = conn.cursor()
cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")
tables = [r[0] for r in cur.fetchall()]
print('TABELAS COM REGISTROS EM az3d_db:')
for t in tables:
    try:
        cur.execute(f'SELECT count(*) FROM "{t}";')
        c = cur.fetchone()[0]
        if c > 0:
            print(f'  {t}: {c}')
    except Exception as e:
        print(f'  {t} erro:', e)
conn.close()
