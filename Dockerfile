FROM node
RUN mkdir /src

COPY . /src

WORKDIR /src

CMD node futurepresent.js


