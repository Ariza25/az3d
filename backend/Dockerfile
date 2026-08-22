FROM golang:1.22-bookworm AS build

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o /out/az3d-server .

FROM debian:bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /out/az3d-server /app/az3d-server

ENV PORT=8080 \
  ENV=production \
  DB_HOST=db \
  DB_PORT=5432 \
  DB_SSLMODE=disable

EXPOSE 8080

CMD ["/app/az3d-server"]
