docker stop flagshiprouter
docker rm flagshiprouter
docker build -t flagshiprouter .
docker run -d --name flagshiprouter -p 20128:20128 --env-file .env -v flagshiprouter-data:/app/data flagshiprouter
