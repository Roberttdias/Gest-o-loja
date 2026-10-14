"""Verificações transacionais e de acesso com banco temporário."""
import concurrent.futures
import contextlib
import http.client
import io
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import threading
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import server


class AppTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        server.DB=Path(self.temp.name)/'test.sqlite3'
        with contextlib.redirect_stdout(io.StringIO()):
            server.initialize('senha-apenas-para-testes')
        server.SESSIONS.clear()
        server.ATTEMPTS.clear()
        self.http=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler)
        self.thread=threading.Thread(target=self.http.serve_forever,daemon=True)
        self.thread.start()
        self.cookie=''
        self.csrf=''

    def tearDown(self):
        self.http.shutdown()
        self.http.server_close()
        self.thread.join()
        self.temp.cleanup()

    def request(self,path,payload=None,private=True,extra=None):
        connection=http.client.HTTPConnection('127.0.0.1',self.http.server_port,timeout=5)
        headers={'Content-Type':'application/json'}
        if private:
            headers.update({'Cookie':self.cookie,'X-CSRF-Token':self.csrf})
        headers.update(extra or {})
        connection.request('GET' if payload is None else 'POST',path,None if payload is None else json.dumps(payload),headers)
        response=connection.getresponse()
        body=response.read()
        result=(response.status,dict(response.getheaders()),json.loads(body) if 'application/json' in response.getheader('Content-Type','') else body)
        connection.close()
        return result

    def login(self):
        status,headers,data=self.request('/api/login',{'username':'admin','password':'senha-apenas-para-testes'})
        self.assertEqual(status,200)
        self.cookie=headers['Set-Cookie'].split(';')[0]
        self.csrf=data['csrf']

    def post(self,path,payload):
        status,_,result=self.request(path,payload)
        self.assertEqual(status,200,result)
        return result

    def product(self,stock=5,**changes):
        data=dict(sku='CAM-01',name='Camisa <teste>',category='Camisas',team='Brasil',size='M',color='Amarela',quality='Torcedor',price=12990,cost=6500,stock=stock,minimum=2,active=1)
        data.update(changes)
        return self.post('/api/products',data)['id']

    def get_state(self):
        return self.request('/api/state')[2]

    def test_authentication_csrf_and_catalog_privacy(self):
        self.assertEqual(self.request('/api/state')[0],401)
        self.assertEqual(self.request('/api/backup')[0],401)
        self.login()
        self.assertEqual(self.request('/api/cash/open',{'amount':0},extra={'X-CSRF-Token':''})[0],403)
        self.assertEqual(self.request('/api/cash/open',{'amount':0},extra={'Origin':'https://outro.site'})[0],403)
        self.product()
        catalog=self.request('/api/catalog',private=False)[2]
        self.assertNotIn('cost',catalog['products'][0])
        self.assertNotIn('password',catalog['settings'])
        self.assertNotIn('salt',catalog['settings'])
        self.post('/api/logout',{})
        self.assertEqual(self.request('/api/state')[0],401)

    def test_sale_discount_stock_cash_and_refund(self):
        self.login()
        pid=self.product()
        cid=self.post('/api/clients',{'name':'Ana','phone':'77999999999'})['id']
        sale=dict(items=[{'id':pid,'quantity':2}],client_id=cid,payment='Dinheiro',discount=990)
        self.assertEqual(self.request('/api/sales',sale)[0],400)  # no open cash
        self.post('/api/cash/open',{'amount':10000})
        result=self.post('/api/sales',sale)
        self.assertEqual(result['total'],24990)
        s=self.get_state()
        self.assertEqual(s['products'][0]['stock'],3)
        self.assertEqual(s['cash']['expected'],34990)
        self.assertEqual(s['sales'][0]['client_id'],cid)
        self.assertEqual(s['sales'][0]['customer'],'Ana')
        self.post('/api/sales/cancel',{'id':result['id']})
        s=self.get_state()
        self.assertEqual(s['products'][0]['stock'],5)
        self.assertEqual(s['cash']['expected'],10000)
        self.assertEqual(self.request('/api/sales/cancel',{'id':result['id']})[0],400)
        self.assertEqual(self.get_state()['products'][0]['stock'],5)

    def test_order_reservation_snapshot_and_single_confirmation(self):
        self.login()
        pid=self.product()
        order=self.post('/api/orders',{'customer':'João','phone':'77999999999','note':'Retirada amanhã','items':[{'id':pid,'quantity':2}],'total':1})
        self.assertEqual(order['total'],25980)
        self.assertEqual(self.get_state()['products'][0]['stock'],3)
        p=self.get_state()['products'][0]
        p['price']=20000
        self.post('/api/products',p)
        self.assertEqual(self.request('/api/orders/status',{'id':order['id'],'status':'Confirmado','payment':'Pix'})[0],400)
        self.assertEqual(self.get_state()['orders'][0]['status'],'Pendente')
        self.post('/api/cash/open',{'amount':0})
        self.post('/api/orders/status',{'id':order['id'],'status':'Confirmado','payment':'Pix'})
        s=self.get_state()
        self.assertEqual(s['products'][0]['stock'],3)
        self.assertEqual(s['sales'][0]['total'],25980)  # original quoted price
        self.assertEqual(s['cash']['expected'],0)  # Pix is not physical cash
        self.assertEqual(self.request('/api/orders/status',{'id':order['id'],'status':'Confirmado','payment':'Pix'})[0],400)
        self.assertEqual(len(self.get_state()['sales']),1)

    def test_order_cancel_and_concurrent_last_unit(self):
        self.login()
        pid=self.product(stock=1)
        payload={'customer':'Cliente','phone':'77999999999','items':[{'id':pid,'quantity':1}]}
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            results=list(executor.map(lambda _:self.request('/api/orders',payload,private=False),range(2)))
        self.assertEqual(sorted(r[0] for r in results),[200,400])
        s=self.get_state()
        self.assertEqual(s['products'][0]['stock'],0)
        self.assertEqual(len(s['orders']),1)
        self.post('/api/orders/status',{'id':s['orders'][0]['id'],'status':'Cancelado'})
        self.assertEqual(self.get_state()['products'][0]['stock'],1)

    def test_transaction_rollback_invalid_items_and_duplicate_sku(self):
        self.login()
        pid=self.product(stock=1)
        self.post('/api/cash/open',{'amount':0})
        for items in ([{'id':pid,'quantity':1},{'id':999,'quantity':1}], [{'id':pid,'quantity':1},{'id':pid,'quantity':1}], [{'id':pid,'quantity':True}], [{'id':pid,'quantity':0}]):
            self.assertEqual(self.request('/api/sales',{'items':items,'payment':'Pix','discount':0})[0],400)
        self.assertEqual(self.get_state()['products'][0]['stock'],1)
        self.assertEqual(len(self.get_state()['sales']),0)
        self.assertEqual(self.request('/api/products',dict(sku='CAM-01',name='Duplicado',category='Outros',price=1,cost=1,stock=0,minimum=0,active=1))[0],409)
        self.assertEqual(self.request('/api/stock',{'id':pid,'delta':-2,'reason':'Contagem'})[0],400)
        self.assertEqual(self.get_state()['products'][0]['stock'],1)

    def test_close_cash_csv_and_consistent_backup(self):
        self.login()
        pid=self.product()
        cid=self.post('/api/clients',{'name':'=CLIENTE','phone':''})['id']
        self.post('/api/cash/open',{'amount':10000})
        sale=self.post('/api/sales',{'items':[{'id':pid,'quantity':1}],'payment':'Dinheiro','discount':0,'client_id':cid})
        self.post('/api/cash/move',{'kind':'Sangria','amount':5000,'note':'Retirada'})
        self.post('/api/cash/move',{'kind':'Suprimento','amount':1000,'note':'Troco'})
        self.assertEqual(self.get_state()['cash']['expected'],18990)
        self.post('/api/cash/close',{'amount':18000,'note':'Diferença a conferir'})
        s=self.get_state()
        self.assertIsNone(s['cash'])
        self.assertEqual(s['cash_history'][0]['expected'],18990)
        self.assertEqual(s['cash_history'][0]['counted'],18000)
        self.post('/api/cash/open',{'amount':0})
        self.assertEqual(self.request('/api/sales/cancel',{'id':sale['id']})[0],400)
        csv=self.request('/api/export')[2].decode('utf-8-sig')
        self.assertIn("'=CLIENTE",csv)
        self.assertIn('129,90',csv)
        backup=self.request('/api/backup')[2]
        target=Path(self.temp.name)/'copy.sqlite3'
        target.write_bytes(backup)
        with sqlite3.connect(target) as db:
            self.assertEqual(db.execute('PRAGMA integrity_check').fetchone()[0],'ok')
            self.assertEqual(db.execute('SELECT COUNT(*) FROM sales').fetchone()[0],1)


if __name__ == '__main__':
    unittest.main(verbosity=2)
