
npm run build

docker swarm init
docker service create --name registry --publish published=5000,target=5000 registry:2
docker service ls
docker-compose build
docker-compose push
docker stack deploy --compose-file docker-compose.yml smule
docker stack services smule

#Remove
docker stack rm smule
docker service rm registry
docker swarm leave --force



docker service logs smule_traefik
docker logs CONTAINeR
docker service logs smule_traefik

#Database
docker exec -it $(docker ps -f name=smule_database -q) cat /run/secrets/db_root_password
docker exec -it $(docker ps -f name=smule_database -q) cat /run/secrets/db_smule_password
docker exec -it $(docker ps -f name=smule_database -q) mysql -u root -p

docker service rm initialise
docker build -f ../server/DockerfileInitialise ../server/ -t 127.0.0.1:5000/initialise-0.1.0.1 && docker service create --restart-condition=none --secret db_smule_password --name initialise 127.0.0.1:5000/initialise-0.1.0.1

docker service rm migrate
docker build -f ../server/DockerfileMigrate ../server/ -t 127.0.0.1:5000/migrate-0.1.0.1 && docker service create --restart-condition=none --secret db_smule_password --name migrate 127.0.0.1:5000/migrate-0.1.0.1

#Update
docker service update --image 127.0.0.1:5000/server-0.1.0.2 smule_server
docker service update --image 127.0.0.1:5000/crumb_server-0.0.0.6 smule_crumb_server

docker service scale smule_server=0
