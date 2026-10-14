#!/usr/bin/env python3
"""Skinão do Esporte: gestão e catálogo, Python 3.11+ / SQLite."""
import argparse
from contextlib import contextmanager
import csv
import hashlib
import hmac
import io
import json
import os
from pathlib import Path
import secrets
import sqlite3
import tempfile
import threading
import time
from datetime import datetime, timezone, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

ROOT = Path(__file__).resolve().parent
DB = Path(os.environ.get('SKINAO_DB', ROOT / 'data' / 'skinao.sqlite3'))
SESSIONS = {}
ATTEMPTS = {}
LOCK = threading.Lock()
PAYMENTS = ('Dinheiro', 'Pix', 'Débito', 'Crédito')
try:
    LOCAL_ZONE = ZoneInfo('America/Bahia')
except ZoneInfoNotFoundError:
    LOCAL_ZONE = timezone(timedelta(hours=-3))


def now():
    return datetime.now(LOCAL_ZONE).isoformat(timespec='seconds')


@contextmanager
def connect():
    db = sqlite3.connect(DB, timeout=15)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def rows(db, sql, args=()):
    return [dict(x) for x in db.execute(sql, args)]


def password_hash(password, salt):
    return hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()


def initialize(password=None, demo=False):
    DB.parent.mkdir(parents=True, exist_ok=True)
    with connect() as db:
        db.executescript('''
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS products(
          id INTEGER PRIMARY KEY,sku TEXT UNIQUE NOT NULL,name TEXT NOT NULL,category TEXT NOT NULL,
          team TEXT NOT NULL DEFAULT '',size TEXT NOT NULL DEFAULT '',color TEXT NOT NULL DEFAULT '',
          quality TEXT NOT NULL DEFAULT '',price INTEGER NOT NULL CHECK(price>=0),
          cost INTEGER NOT NULL CHECK(cost>=0),stock INTEGER NOT NULL CHECK(stock>=0),
          minimum INTEGER NOT NULL CHECK(minimum>=0),active INTEGER NOT NULL DEFAULT 1);
        CREATE TABLE IF NOT EXISTS clients(id INTEGER PRIMARY KEY,name TEXT NOT NULL,phone TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS cash(id INTEGER PRIMARY KEY,opened TEXT NOT NULL,closed TEXT,
          opening INTEGER NOT NULL,expected INTEGER,counted INTEGER,note TEXT NOT NULL DEFAULT '');
        CREATE UNIQUE INDEX IF NOT EXISTS one_open_cash ON cash((1)) WHERE closed IS NULL;
        CREATE TABLE IF NOT EXISTS movements(id INTEGER PRIMARY KEY,cash_id INTEGER NOT NULL REFERENCES cash(id),
          created TEXT NOT NULL,kind TEXT NOT NULL,amount INTEGER NOT NULL,note TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY,created TEXT NOT NULL,customer TEXT NOT NULL,
          phone TEXT NOT NULL,note TEXT NOT NULL,status TEXT NOT NULL,total INTEGER NOT NULL,token TEXT NOT NULL UNIQUE);
        CREATE TABLE IF NOT EXISTS sales(id INTEGER PRIMARY KEY,created TEXT NOT NULL,customer TEXT NOT NULL,
          payment TEXT NOT NULL,subtotal INTEGER NOT NULL,discount INTEGER NOT NULL,total INTEGER NOT NULL,
          cost INTEGER NOT NULL,cash_id INTEGER NOT NULL REFERENCES cash(id),client_id INTEGER REFERENCES clients(id),
          order_id INTEGER UNIQUE REFERENCES orders(id),canceled TEXT);
        CREATE TABLE IF NOT EXISTS sale_items(id INTEGER PRIMARY KEY,sale_id INTEGER NOT NULL REFERENCES sales(id),
          product_id INTEGER NOT NULL REFERENCES products(id),name TEXT NOT NULL,sku TEXT NOT NULL,
          quantity INTEGER NOT NULL,price INTEGER NOT NULL,cost INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS order_items(id INTEGER PRIMARY KEY,order_id INTEGER NOT NULL REFERENCES orders(id),
          product_id INTEGER NOT NULL REFERENCES products(id),name TEXT NOT NULL,sku TEXT NOT NULL,
          quantity INTEGER NOT NULL,price INTEGER NOT NULL,cost INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS stock_log(id INTEGER PRIMARY KEY,created TEXT NOT NULL,
          product_id INTEGER NOT NULL REFERENCES products(id),delta INTEGER NOT NULL,reason TEXT NOT NULL);
        ''')
        if not db.execute("SELECT 1 FROM settings WHERE key='password'").fetchone():
            password = password or secrets.token_urlsafe(15)
            if len(password) < 12:
                raise ValueError('A senha deve ter pelo menos 12 caracteres.')
            salt = secrets.token_hex(16)
            db.executemany('INSERT INTO settings VALUES(?,?)', [
                ('salt', salt), ('password', password_hash(password, salt)),
                ('name', 'Skinão do Esporte'), ('location', 'Feira Livre · Barreiras, BA'),
                ('whatsapp', ''), ('demo', '1' if demo else '0')])
            print('\nPrimeiro acesso: usuário admin | senha: ' + password + '\n', flush=True)
            if demo:
                samples = [
                    ('CAM-FLA-M','Camisa Flamengo','Camisas','Flamengo','M','Vermelho e preto','Torcedor',12990,6500,12,3),
                    ('CAM-BRA-G','Camisa Brasil','Camisas','Brasil','G','Amarela','Torcedor',11990,5800,8,3),
                    ('CHU-SOC-40','Chuteira society','Chuteiras','','40','Preta','',19990,11500,4,2),
                    ('CON-INF-10','Conjunto infantil Brasil','Infantil','Brasil','10','Amarela','',9990,4500,6,2),
                    ('BOL-CAM-5','Bola de futebol campo','Bolas','','5','Branca','',8990,4200,2,3),
                    ('MEI-PRE-U','Meião de futebol','Acessórios','','Único','Preto','',2490,1000,18,5),
                    ('LUVA-GOL-9','Luva de goleiro','Acessórios','','9','Laranja','',14990,7900,3,2),
                    ('SHO-TRE-M','Short de treino','Treino','','M','Preto','',5990,2500,10,3)]
                db.executemany('INSERT INTO products(sku,name,category,team,size,color,quality,price,cost,stock,minimum) VALUES(?,?,?,?,?,?,?,?,?,?,?)',samples)


class BusinessError(Exception):
    pass


def text_field(data, key, required=True, limit=180):
    v = data.get(key, '')
    if not isinstance(v, str) or len(v.strip()) > limit or (required and not v.strip()):
        raise BusinessError('Confira o campo ' + key + '.')
    return v.strip()


def integer(data, key, minimum=0, maximum=100_000_000):
    v = data.get(key)
    if type(v) is not int or not minimum <= v <= maximum:
        raise BusinessError('Valor inválido: ' + key + '.')
    return v


def item_list(db, data):
    items = data.get('items')
    if not isinstance(items, list) or not 1 <= len(items) <= 100:
        raise BusinessError('Adicione de 1 a 100 produtos.')
    result, seen = [], set()
    for item in items:
        if not isinstance(item, dict):
            raise BusinessError('Item inválido.')
        pid, qty = integer(item, 'id', 1), integer(item, 'quantity', 1, 999)
        if pid in seen:
            raise BusinessError('Produto repetido no carrinho.')
        seen.add(pid)
        p = db.execute('SELECT * FROM products WHERE id=? AND active=1', (pid,)).fetchone()
        if not p or p['stock'] < qty:
            raise BusinessError('Estoque insuficiente. Atualize o carrinho.')
        result.append((dict(p), qty))
    return result


def open_cash(db):
    cash = db.execute('SELECT * FROM cash WHERE closed IS NULL').fetchone()
    if not cash:
        raise BusinessError('Abra o caixa antes de registrar uma venda.')
    return dict(cash)


def expected_cash(db, cash):
    sales = db.execute("SELECT COALESCE(SUM(total),0) FROM sales WHERE cash_id=? AND payment='Dinheiro' AND canceled IS NULL", (cash['id'],)).fetchone()[0]
    moves = db.execute('SELECT COALESCE(SUM(amount),0) FROM movements WHERE cash_id=?', (cash['id'],)).fetchone()[0]
    return cash['opening'] + sales + moves


def stock_change(db, pid, delta, reason):
    changed = db.execute('UPDATE products SET stock=stock+? WHERE id=? AND stock+?>=0', (delta, pid, delta))
    if changed.rowcount != 1:
        raise BusinessError('Estoque insuficiente.')
    db.execute('INSERT INTO stock_log(created,product_id,delta,reason) VALUES(?,?,?,?)', (now(), pid, delta, reason))


def record_sale(db, items, customer, payment, discount=0, order_id=None, client_id=None):
    if payment not in PAYMENTS:
        raise BusinessError('Selecione uma forma de pagamento.')
    cash = open_cash(db)
    subtotal = sum(p['price'] * q for p, q in items)
    cost = sum(p['cost'] * q for p, q in items)
    if not 0 <= discount <= subtotal:
        raise BusinessError('Desconto maior que o valor da venda.')
    sid = db.execute('INSERT INTO sales(created,customer,payment,subtotal,discount,total,cost,cash_id,order_id,client_id) VALUES(?,?,?,?,?,?,?,?,?,?)',
                     (now(),customer,payment,subtotal,discount,subtotal-discount,cost,cash['id'],order_id,client_id)).lastrowid
    for p, q in items:
        if not order_id:
            stock_change(db,p['id'],-q,'Venda #' + str(sid))
        db.execute('INSERT INTO sale_items(sale_id,product_id,name,sku,quantity,price,cost) VALUES(?,?,?,?,?,?,?)',
                   (sid,p['id'],p['name'],p['sku'],q,p['price'],p['cost']))
    return {'id':sid,'total':subtotal-discount}


def mutate(db, path, data):
    if path == '/api/products':
        fields = [text_field(data, 'sku'),text_field(data,'name'),text_field(data,'category')]
        fields += [text_field(data,k,False) for k in ('team','size','color','quality')]
        fields += [integer(data,k) for k in ('price','cost','minimum')]
        active = integer(data,'active',0,1)
        pid = data.get('id')
        if pid is not None:
            pid = integer(data,'id',1)
            if not db.execute('SELECT 1 FROM products WHERE id=?',(pid,)).fetchone():
                raise BusinessError('Produto não encontrado.')
            db.execute('UPDATE products SET sku=?,name=?,category=?,team=?,size=?,color=?,quality=?,price=?,cost=?,minimum=?,active=? WHERE id=?',fields+[active,pid])
        else:
            stock = integer(data,'stock')
            pid = db.execute('INSERT INTO products(sku,name,category,team,size,color,quality,price,cost,minimum,active,stock) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',fields+[active,stock]).lastrowid
            db.execute('INSERT INTO stock_log(created,product_id,delta,reason) VALUES(?,?,?,?)',(now(),pid,stock,'Cadastro inicial'))
        return {'id':pid}
    if path == '/api/stock':
        pid = integer(data,'id',1)
        delta = integer(data,'delta',-1_000_000,1_000_000)
        reason = text_field(data,'reason')
        stock_change(db,pid,delta,reason)
        return {'ok':True}
    if path == '/api/clients':
        name, phone = text_field(data,'name'),text_field(data,'phone',False,40)
        cid = db.execute('INSERT INTO clients(name,phone) VALUES(?,?)',(name,phone)).lastrowid
        return {'id':cid}
    if path == '/api/sales':
        client_id = data.get('client_id')
        customer = 'Consumidor'
        if client_id is not None:
            client_id = integer(data,'client_id',1)
            client = db.execute('SELECT name FROM clients WHERE id=?',(client_id,)).fetchone()
            if not client:
                raise BusinessError('Cliente não encontrado.')
            customer = client['name']
        return record_sale(db,item_list(db,data),customer,text_field(data,'payment'),integer(data,'discount'),client_id=client_id)
    if path == '/api/sales/cancel':
        sid = integer(data,'id',1)
        sale = db.execute('SELECT * FROM sales WHERE id=? AND canceled IS NULL',(sid,)).fetchone()
        cash = open_cash(db)
        if not sale or sale['cash_id'] != cash['id']:
            raise BusinessError('Só é possível estornar vendas do caixa aberto atual.')
        for item in db.execute('SELECT * FROM sale_items WHERE sale_id=?',(sid,)).fetchall():
            stock_change(db,item['product_id'],item['quantity'],'Estorno da venda #' + str(sid))
        db.execute('UPDATE sales SET canceled=? WHERE id=?',(now(),sid))
        if sale['order_id']:
            db.execute("UPDATE orders SET status='Cancelado' WHERE id=?",(sale['order_id'],))
        return {'ok':True}
    if path == '/api/cash/open':
        if db.execute('SELECT 1 FROM cash WHERE closed IS NULL').fetchone():
            raise BusinessError('Já existe um caixa aberto.')
        db.execute('INSERT INTO cash(opened,opening) VALUES(?,?)',(now(),integer(data,'amount')))
        return {'ok':True}
    if path == '/api/cash/move':
        cash = open_cash(db)
        amount = integer(data,'amount',1)
        kind = text_field(data,'kind')
        if kind not in ('Sangria','Suprimento'):
            raise BusinessError('Movimentação inválida.')
        if kind == 'Sangria':
            amount = -amount
            if expected_cash(db,cash)+amount < 0:
                raise BusinessError('Sangria maior que o saldo em dinheiro.')
        db.execute('INSERT INTO movements(cash_id,created,kind,amount,note) VALUES(?,?,?,?,?)',(cash['id'],now(),kind,amount,text_field(data,'note')))
        return {'ok':True}
    if path == '/api/cash/close':
        cash = open_cash(db)
        db.execute('UPDATE cash SET closed=?,expected=?,counted=?,note=? WHERE id=?',
                   (now(),expected_cash(db,cash),integer(data,'amount'),text_field(data,'note',False),cash['id']))
        return {'ok':True}
    if path == '/api/orders':
        items = item_list(db,data)
        customer,phone = text_field(data,'customer'),text_field(data,'phone',True,40)
        if len(''.join(filter(str.isdigit,phone))) not in (10,11,12,13):
            raise BusinessError('Informe um telefone com DDD.')
        token = secrets.token_urlsafe(24)
        total = sum(p['price']*q for p,q in items)
        oid = db.execute("INSERT INTO orders(created,customer,phone,note,status,total,token) VALUES(?,?,?,?,?,?,?)",(now(),customer,phone,text_field(data,'note',False,500),'Pendente',total,token)).lastrowid
        for p,q in items:
            stock_change(db,p['id'],-q,'Reserva do pedido #' + str(oid))
            db.execute('INSERT INTO order_items(order_id,product_id,name,sku,quantity,price,cost) VALUES(?,?,?,?,?,?,?)',(oid,p['id'],p['name'],p['sku'],q,p['price'],p['cost']))
        return {'id':oid,'total':total,'message':'Pedido recebido. Aguarde a confirmação da loja. Nenhum pagamento foi cobrado.'}
    if path == '/api/orders/status':
        oid,status = integer(data,'id',1),text_field(data,'status')
        order = db.execute('SELECT * FROM orders WHERE id=?',(oid,)).fetchone()
        if not order or order['status'] != 'Pendente' or status not in ('Confirmado','Cancelado'):
            raise BusinessError('Esse pedido já foi processado ou não existe.')
        order_items = rows(db,'SELECT * FROM order_items WHERE order_id=?',(oid,))
        if status == 'Cancelado':
            for item in order_items:
                stock_change(db,item['product_id'],item['quantity'],'Cancelamento do pedido #' + str(oid))
        else:
            items = [(dict(id=i['product_id'],name=i['name'],sku=i['sku'],price=i['price'],cost=i['cost']),i['quantity']) for i in order_items]
            record_sale(db,items,order['customer'],text_field(data,'payment'),0,oid)
        db.execute('UPDATE orders SET status=? WHERE id=?',(status,oid))
        return {'ok':True}
    if path == '/api/settings':
        name,location,whatsapp = text_field(data,'name'),text_field(data,'location'),text_field(data,'whatsapp',False,20)
        if whatsapp and (not whatsapp.isdigit() or len(whatsapp) not in (12,13) or not whatsapp.startswith('55')):
            raise BusinessError('WhatsApp deve conter 55, DDD e número, apenas dígitos.')
        for k,v in [('name',name),('location',location),('whatsapp',whatsapp)]:
            db.execute('UPDATE settings SET value=? WHERE key=?',(v,k))
        return {'ok':True}
    raise BusinessError('Operação não encontrada.')


def state(db):
    cash = db.execute('SELECT * FROM cash WHERE closed IS NULL').fetchone()
    cash = dict(cash) if cash else None
    if cash:
        cash['expected'] = expected_cash(db,cash)
        cash['payments'] = rows(db,'SELECT payment,SUM(total) AS total FROM sales WHERE cash_id=? AND canceled IS NULL GROUP BY payment',(cash['id'],))
    return dict(products=rows(db,'SELECT * FROM products ORDER BY name,size'),
                clients=rows(db,'SELECT * FROM clients ORDER BY name'),
                sales=rows(db,'SELECT * FROM sales ORDER BY id DESC'),
                sale_items=rows(db,'SELECT * FROM sale_items'),
                orders=rows(db,'SELECT id,created,customer,phone,note,status,total FROM orders ORDER BY id DESC'),
                order_items=rows(db,'SELECT * FROM order_items'),
                cash=cash,cash_history=rows(db,'SELECT * FROM cash ORDER BY id DESC LIMIT 100'),
                movements=rows(db,'SELECT * FROM movements ORDER BY id DESC LIMIT 200'),
                stock_log=rows(db,'SELECT l.*,p.name,p.sku FROM stock_log l JOIN products p ON p.id=l.product_id ORDER BY l.id DESC LIMIT 200'),
                settings=dict(db.execute("SELECT key,value FROM settings WHERE key NOT IN ('salt','password')")),today=now()[:10])


class Handler(BaseHTTPRequestHandler):
    server_version = 'Skinao/1.0'

    def log_message(self, fmt, *args):
        # Do not log customer payloads, authentication headers or query strings.
        pass

    def send(self, status, body, content_type='application/json; charset=utf-8', extra=None):
        if isinstance(body,(dict,list)):
            body = json.dumps(body,ensure_ascii=False).encode()
        if isinstance(body,str):
            body = body.encode()
        self.send_response(status)
        self.send_header('Content-Type',content_type)
        self.send_header('Content-Length',str(len(body)))
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Referrer-Policy','same-origin')
        self.send_header('Content-Security-Policy',"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
        for key,value in (extra or {}).items():
            self.send_header(key,value)
        self.end_headers()
        self.wfile.write(body)

    def session(self):
        cookies = dict(x.strip().split('=',1) for x in self.headers.get('Cookie','').split(';') if '=' in x)
        token = cookies.get('skinao','')
        with LOCK:
            expired = [k for k,v in SESSIONS.items() if v['expires'] < time.time()]
            for k in expired:
                SESSIONS.pop(k,None)
            return token,SESSIONS.get(token)

    def rate_limit(self, category, maximum, seconds):
        key = (category,self.client_address[0])
        with LOCK:
            t = time.time()
            if len(ATTEMPTS) > 10000:
                for k in list(ATTEMPTS):
                    if not ATTEMPTS[k] or ATTEMPTS[k][-1] < t-3600:
                        del ATTEMPTS[k]
            times = [x for x in ATTEMPTS.get(key,[]) if t-x < seconds]
            if len(times) >= maximum:
                return False
            ATTEMPTS[key] = times + [t]
            return True

    def do_GET(self):
        path = urlparse(self.path).path
        if path in ('/','/catalogo','/gestao'):
            return self.send(200,(ROOT/'static/index.html').read_bytes(),'text/html; charset=utf-8')
        if path in ('/app.js','/style.css'):
            return self.send(200,(ROOT/'static'/path[1:]).read_bytes(),'text/javascript; charset=utf-8' if path.endswith('.js') else 'text/css; charset=utf-8')
        if path == '/favicon.svg':
            return self.send(200,(ROOT/'static/favicon.svg').read_bytes(),'image/svg+xml')
        if path == '/api/catalog':
            with connect() as db:
                return self.send(200,dict(products=rows(db,'SELECT id,sku,name,category,team,size,color,quality,price,stock FROM products WHERE active=1 ORDER BY name,size'),settings=dict(db.execute("SELECT key,value FROM settings WHERE key IN ('name','location','whatsapp','demo')"))))
        _,session = self.session()
        if path == '/api/session':
            return self.send(200,dict(authenticated=bool(session),csrf=session['csrf'] if session else None))
        if path not in ('/api/state','/api/export','/api/backup'):
            return self.send(404,{'error':'Página não encontrada.'})
        if not session:
            return self.send(401,{'error':'Entre para acessar a gestão.'})
        if path == '/api/state':
            with connect() as db:
                return self.send(200,state(db))
        if path == '/api/export':
            with connect() as db:
                records = rows(db,'SELECT created,customer,payment,subtotal,discount,total,cost,canceled FROM sales ORDER BY id DESC')
            out = io.StringIO()
            writer = csv.writer(out,delimiter=';')
            writer.writerow(['Data','Cliente','Pagamento','Subtotal (R$)','Desconto (R$)','Total (R$)','Custo (R$)','Cancelado em'])
            for record in records:
                vals = list(record.values())
                for i in (3,4,5,6):
                    vals[i] = ('%.2f' % (vals[i]/100)).replace('.',',')
                writer.writerow(["'"+v if isinstance(v,str) and v[:1] in ('=','+','-','@','\t','\r') else v for v in vals])
            return self.send(200,'\ufeff'+out.getvalue(),'text/csv; charset=utf-8',{'Content-Disposition':'attachment; filename="skinao-vendas.csv"'})
        if path == '/api/backup':
            with tempfile.TemporaryDirectory() as folder:
                target = Path(folder)/'backup.sqlite3'
                with connect() as source,sqlite3.connect(target) as dest:
                    source.backup(dest)
                content = target.read_bytes()
            return self.send(200,content,'application/octet-stream',{'Content-Disposition':'attachment; filename="skinao-backup.sqlite3"'})
        self.send(404,{'error':'Página não encontrada.'})

    def do_POST(self):
        path = urlparse(self.path).path
        origin = self.headers.get('Origin')
        if origin:
            parsed = urlparse(origin)
            if parsed.netloc != self.headers.get('Host') or parsed.scheme not in ('http','https'):
                return self.send(403,{'error':'Origem não permitida.'})
        if self.headers.get('Sec-Fetch-Site') == 'cross-site':
            return self.send(403,{'error':'Origem não permitida.'})
        if not self.headers.get('Content-Type','').startswith('application/json'):
            return self.send(415,{'error':'Envie JSON.'})
        try:
            length = int(self.headers.get('Content-Length','0'))
            if not 0 < length <= 65536:
                return self.send(413,{'error':'Requisição muito grande ou vazia.'})
            data = json.loads(self.rfile.read(length))
            if not isinstance(data,dict):
                raise ValueError()
        except (ValueError,UnicodeDecodeError):
            return self.send(400,{'error':'Dados inválidos.'})
        token,session = self.session()
        if path == '/api/login':
            if not self.rate_limit('login',10,900):
                return self.send(429,{'error':'Muitas tentativas. Aguarde 15 minutos.'})
            with connect() as db:
                settings = dict(db.execute("SELECT key,value FROM settings WHERE key IN ('salt','password')"))
            password = data.get('password','')
            if not isinstance(password,str) or len(password)>1024:
                return self.send(400,{'error':'Senha inválida.'})
            good = hmac.compare_digest(password_hash(password,settings['salt']),settings['password'])
            if data.get('username') != 'admin' or not good:
                return self.send(401,{'error':'Usuário ou senha inválidos.'})
            token,csrf = secrets.token_urlsafe(32),secrets.token_urlsafe(32)
            with LOCK:
                if len(SESSIONS)>200:
                    SESSIONS.clear()
                SESSIONS[token] = {'csrf':csrf,'expires':time.time()+8*3600}
            secure = '; Secure' if os.environ.get('SKINAO_SECURE_COOKIE') == '1' else ''
            return self.send(200,{'csrf':csrf},extra={'Set-Cookie':f'skinao={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800'+secure})
        if path != '/api/orders':
            if not session:
                return self.send(401,{'error':'Entre para acessar a gestão.'})
            if not hmac.compare_digest(self.headers.get('X-CSRF-Token',''),session['csrf']):
                return self.send(403,{'error':'Sessão inválida. Atualize a página.'})
        elif not self.rate_limit('orders',10,3600):
            return self.send(429,{'error':'Limite de pedidos atingido. Entre em contato com a loja.'})
        if path == '/api/logout':
            with LOCK:
                SESSIONS.pop(token,None)
            return self.send(200,{'ok':True},extra={'Set-Cookie':'skinao=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'})
        try:
            with connect() as db:
                db.execute('BEGIN IMMEDIATE')
                result = mutate(db,path,data)
            self.send(200,result)
        except BusinessError as exc:
            self.send(400,{'error':str(exc)})
        except sqlite3.IntegrityError:
            self.send(409,{'error':'Código já cadastrado ou operação em conflito. Atualize e confira os dados.'})
        except sqlite3.OperationalError:
            self.send(503,{'error':'Banco ocupado ou indisponível. Tente novamente.'})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port',type=int,default=8000)
    parser.add_argument('--host',default='127.0.0.1')
    parser.add_argument('--demo',action='store_true',help='Inclui produtos fictícios apenas na criação de um banco novo.')
    parser.add_argument('--open-browser',action='store_true',help='Abre a gestão no navegador padrão deste computador.')
    parser.add_argument('--reset-password',action='store_true',help='Altera a senha local do administrador e encerra. Pare o servidor antes.')
    args = parser.parse_args()
    if args.reset_password:
        import getpass
        if not DB.exists():
            parser.error('Ainda não existe um banco. Inicie o sistema primeiro.')
        password = getpass.getpass('Nova senha (pelo menos 12 caracteres): ')
        if len(password) < 12 or password != getpass.getpass('Repita a nova senha: '):
            parser.error('Senha curta ou confirmação diferente.')
        salt = secrets.token_hex(16)
        with connect() as db:
            db.execute("UPDATE settings SET value=? WHERE key='salt'",(salt,))
            db.execute("UPDATE settings SET value=? WHERE key='password'",(password_hash(password,salt),))
        print('Senha alterada. Inicie o servidor novamente.')
        return
    initialize(os.environ.get('SKINAO_ADMIN_PASSWORD'),args.demo)
    print(f'Catálogo: http://{args.host}:{args.port}/catalogo\nGestão: http://{args.host}:{args.port}/gestao',flush=True)
    http = ThreadingHTTPServer((args.host,args.port),Handler)
    if args.open_browser:
        import webbrowser
        threading.Timer(0.8,lambda:webbrowser.open(f'http://127.0.0.1:{args.port}/gestao')).start()
    try:
        http.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        http.server_close()


if __name__ == '__main__':
    main()
