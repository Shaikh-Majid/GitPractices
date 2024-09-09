FROM ubuntu as os
LABEL description="My nginx image"
RUN apt-get update -y
RUN apt-get install nginx -y

FROM scratch
WORKDIR /var/www/html
COPY --from=os index.html ./
EXPOSE 80

CMD ["nginx","-g","daemon off;"]
