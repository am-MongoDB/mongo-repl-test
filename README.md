# mongo-repl-test

```
docker network create mongo-net

docker run -dit --name mongo1 --hostname mongo1 --network mongo-net my-custom-mongo bash
docker run -dit --name mongo2 --hostname mongo2 --network mongo-net my-custom-mongo bash
docker run -dit --name mongo3 --hostname mongo3 --network mongo-net my-custom-mongo bash
```
