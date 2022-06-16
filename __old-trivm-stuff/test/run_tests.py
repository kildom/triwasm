
import io
import os.path
import traceback
import json
import inspect
import jinja2

import test_utils
import tests

total_count = 0
failed_count = 0
report = []

for (n, func) in tests.__dict__.items():
	if not n.startswith('test_') or not callable(func):
		continue
	total_count += 1
	print(f'Executing {n}...')
	test_utils.runs = []
	r = test_utils.Empty()
	r.name = n
	try:
		func()
	except:
		failed_count += 1
		print('    Failed!')
		tmp = io.StringIO()
		traceback.print_exc(file=tmp)
		r.ok = False
		r.trace = tmp.getvalue()
	else:
		print('    OK')
		r.ok = True
		r.trace = ''
	r.source =  inspect.getsource(func)
	r.runs = test_utils.runs
	report.append(r)

print('-------------------------------------------------')
print(f'Tests total: {total_count}, success: {total_count - failed_count}, failed: {failed_count}')
print('-------------------------------------------------')

f = open(os.path.join(os.path.dirname(__file__), 'report.jinja.html'), 'r')
t = f.read()
f.close()
env = jinja2.Environment()
template = env.from_string(t)
text = template.render(tests=report, total_count=total_count, failed_count=failed_count)
f = open(os.path.join(os.path.dirname(__file__), 'report.html'), 'w')
f.write(text)
f.close()
