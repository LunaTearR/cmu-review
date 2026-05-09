# --- build stage ---
FROM golang:1.26-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o server  ./cmd/main.go && \
    CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o migrate ./cmd/migrate/main.go && \
    CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o seed    ./cmd/seed/main.go

# --- runtime stage ---
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata
ENV TZ=Asia/Bangkok

WORKDIR /app

COPY --from=builder /app/server   .
COPY --from=builder /app/migrate  .
COPY --from=builder /app/seed     .
COPY --from=builder /app/migrations ./migrations

EXPOSE 8080

ENTRYPOINT ["./server"]
