@echo off
cd /d "%~dp0"
"C:\Users\alamu\AppData\Local\Programs\Python\Python310\python.exe" manage.py runserver 0.0.0.0:8000 --noreload > django_runserver.out.log 2> django_runserver.err.log
