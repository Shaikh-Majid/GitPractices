FROM ubuntu
LABEL description="My nginx image"
RUN apt-get update -y
RUN apt-get install nginx -y

FROM nginx:alpine as os
WORKDIR /var/www/html
COPY index.html ./

EXPOSE 80


FROM os
CMD ["nginx","-g","daemon off;"]
