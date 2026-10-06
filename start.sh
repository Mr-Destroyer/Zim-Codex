docker stop zimrouter
docker rm zimrouter
docker build -t zimrouter .
docker run -d --name zimrouter -p 20128:20128 --env-file .env -v flagshiprouter-data:/app/data zimrouter
