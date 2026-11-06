# ---- build stage ----------------------------------------------------------
FROM rust:1-slim-bookworm AS builder
WORKDIR /src

COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY web ./web
COPY games ./games
COPY site.json ./

RUN cargo build --release && ./target/release/clayplay --check

# ---- runtime stage --------------------------------------------------------
FROM debian:bookworm-slim
RUN useradd --system --uid 10001 --home-dir /app --shell /usr/sbin/nologin clayplay
WORKDIR /app

COPY --from=builder /src/target/release/clayplay /app/clayplay
COPY --from=builder /src/games /app/games
COPY --from=builder /src/site.json /app/site.json
RUN chown -R clayplay:clayplay /app

USER clayplay
ENV CLAY_BIND=0.0.0.0:8080 \
    CLAY_GAMES_DIR=/app/games \
    CLAY_SITE_FILE=/app/site.json \
    CLAY_WATCH=0 \
    RUST_LOG=clayplay=info,tower_http=warn

EXPOSE 8080
CMD ["/app/clayplay"]
