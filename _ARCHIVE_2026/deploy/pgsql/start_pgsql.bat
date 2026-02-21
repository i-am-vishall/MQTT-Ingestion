@ECHO ON
REM The script sets environment variables helpful for PostgreSQL
@SET PATH="%~dp0\bin";%PATH%
@SET PGDATA=%~dp0\data
@SET PGDATABASE=postgres
@SET PGUSER=postgres
@SET PGPORT=5439
@SET PGPASSWORD=server
@SET PGLOCALEDIR=%~dp0\share\locale
icacls "%~dp0data" /grant Users:F
"%~dp0bin\initdb" -U postgres -A trust
"%~dp0bin\pg_ctl.exe" register -N CAC_postgres -D "%~dp0data" -o "-p 5439 "
Net Start CAC_postgres 
"%~dp0bin\psql" -U postgres -c "ALTER USER postgres WITH PASSWORD 'server';"


