# Clay Play

.PHONY: help dev check test build dist fmt clippy clean

help:
	@echo "make dev     本地开发（127.0.0.1:8787）"
	@echo "make check   校验 games/ 与 site.json"
	@echo "make test    运行测试"
	@echo "make dist    构建 dist/ 发布目录"
	@echo "make fmt     cargo fmt"
	@echo "make clippy  cargo clippy"

dev:
	CLAY_BIND=127.0.0.1:8787 cargo run

check:
	cargo run -- --check

test:
	cargo test

build:
	cargo build --release

dist:
	./scripts/build.sh

fmt:
	cargo fmt

clippy:
	cargo clippy --all-targets -- -D warnings

clean:
	cargo clean
	rm -rf dist
