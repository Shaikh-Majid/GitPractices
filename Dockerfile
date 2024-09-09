FROM ubuntu
LABEL description="My nginx image"
RUN apt-get update -y
RUN apt-get install nginx -y

FROM ubuntu as os
WORKDIR /var/www/html


FROM scrach
COPY --from=os index.html ./
EXPOSE 80

CMD ["nginx","-g","daemon off;"]
