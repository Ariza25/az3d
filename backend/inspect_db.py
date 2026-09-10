import psycopg2

conn = psycopg2.connect(dbname='az3d_db', user='postgres', password='mjsa25091996', host='localhost', port='5432')
cur = conn.cursor()

cur.execute("SELECT id, title, source_provider, source_external_id, price FROM products;")
rows = cur.fetchall()
print('TOTAL PRODUTOS NO BANCO:', len(rows))
for r in rows:
    print(f'ID: {r[0]} | Title: {r[1]} | Provider: {r[2]} | ExtID: {r[3]} | Price: {r[4]}')

conn.close()
