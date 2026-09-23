#	Dockerfile
#	This	file	is	a	recipe	that	tells	any	computer	(including
#	Hugging	Face's	servers)	exactly	how	to	build	and	run	our	app,
#	so	it	works	the	same	everywhere.
FROM	python:3.11-slim
#	Start	from	a	small,	pre-made	Linux	image	that	already	has	Python	3.11	installed.
#	"slim"	means	a	stripped-down,	smaller	version	—	faster	to	download.
WORKDIR	/app
#	Sets	/app	as	the	"current	folder"	inside	the	container	for	every	command	below.
COPY	requirements.txt	.
#	Copies	just	this	one	file	first,	before	the	rest	of	our	code.
#	Docker	caches	this	step,	so	rebuilding	is	much	faster	if	only	our	code	changes	later.
RUN	pip	install	--no-cache-dir	-r	requirements.txt
#	Installs	every	Python	package	listed	in	requirements.txt.
#	--no-cache-dir	keeps	the	image	smaller	by	not	storing	pip's	download	cache.
COPY	.	.
#	Copies	EVERYTHING	else	in	our	project	folder	into	the	container.
EXPOSE	8000
#	Documents	that	this	container	listens	on	port	8000	(FastAPI's	default	with	uvicorn).
CMD	["uvicorn",	"app.main:app",	"--host",	"0.0.0.0",	"--port",	"8000"]
#	The	command	that	runs	when	the	container	starts:	launch	uvicorn,	pointing	at
#	the	"app"	object	inside	app/main.py,	listening	on	all	network	interfaces,	port	8000.