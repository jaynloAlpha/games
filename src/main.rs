mod api;
mod assets;
mod config;
mod error;
mod games;
mod models;
mod pages;
mod server;
mod state;
mod store;
mod util;
mod web;

use std::time::Duration;

use tracing_subscriber::EnvFilter;

use crate::config::Config;
use crate::state::AppState;
use crate::store::Store;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("clayplay=info,tower_http=warn")),
        )
        .init();

    let config = Config::load()?;

    if config.check {
        return run_check(&config).await;
    }

    let store = Store::load(config.games_dir.clone(), config.site_file.clone()).await;
    let state = AppState {
        store: store.clone(),
    };

    if config.watch {
        let watcher = store.clone();
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_secs(10)).await;
                if watcher.reload().await {
                    tracing::info!("检测到 games/ 变化，清单已刷新");
                }
            }
        });
    }

    banner(&config, &store).await;

    let app = server::router(state);
    let listener = tokio::net::TcpListener::bind(&config.bind).await?;
    tracing::info!(addr = %config.bind, "Clay Play 已启动");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    tracing::info!("已退出");
    Ok(())
}

async fn run_check(config: &Config) -> anyhow::Result<()> {
    match store::check_catalog(config.games_dir.clone(), config.site_file.clone()).await {
        Ok(report) => {
            println!(
                "✓ 校验通过：{} 个游戏（已发布 {}），站点「{}」",
                report.games.len(),
                report.games.iter().filter(|game| game.published).count(),
                report.site.title
            );
            for game in &report.games {
                println!(
                    "  · {:<24} {:<20} {}{}",
                    game.slug,
                    game.category,
                    game.title,
                    if game.featured { "  ★推荐" } else { "" }
                );
            }
            for warning in &report.warnings {
                println!("  ! {warning}");
            }
            Ok(())
        }
        Err(errors) => {
            eprintln!("✗ 校验失败，共 {} 个问题：", errors.len());
            for error in errors {
                eprintln!("  - {error}");
            }
            std::process::exit(1);
        }
    }
}

async fn banner(config: &Config, store: &Store) {
    let games = store.games().await;
    let published = games.iter().filter(|game| game.published).count();
    let local = if config.bind.starts_with("0.0.0.0:") {
        format!(
            "http://127.0.0.1:{}",
            config.bind.rsplit(':').next().unwrap_or("8080")
        )
    } else if config.bind.starts_with(':') {
        format!("http://127.0.0.1{}", config.bind)
    } else {
        format!("http://{}", config.bind)
    };

    println!();
    println!("  ╭──────────────────────────────────────────────╮");
    println!("  │              倪的乐园 · Clay Play             │");
    println!("  ╰──────────────────────────────────────────────╯");
    println!("   前台      {local}");
    println!(
        "   游戏      {}（已发布 {}） ← {}",
        games.len(),
        published,
        config.games_dir.display()
    );
    println!("   站点      {}", config.site_file.display());
    if config.watch {
        println!("   热加载    已开启（每 10 秒检查 games/）");
    }
    println!();
}

async fn shutdown_signal() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };

    #[cfg(unix)]
    let terminate = async {
        use tokio::signal::unix::{signal, SignalKind};
        if let Ok(mut stream) = signal(SignalKind::terminate()) {
            stream.recv().await;
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
    tracing::info!("收到退出信号");
}
