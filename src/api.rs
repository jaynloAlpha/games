use axum::{
    extract::{Path, State},
    Json,
};
use serde_json::{json, Value};

use crate::error::{AppError, AppResult};
use crate::models::{Game, SiteSettings};
use crate::state::AppState;

pub async fn site(State(state): State<AppState>) -> Json<SiteSettings> {
    Json(state.store.site().await)
}

pub async fn games(State(state): State<AppState>) -> Json<Value> {
    let games = state.store.public_games().await;
    let site = state.store.site().await;
    Json(json!({
        "games": games,
        "categories": site.categories,
        "total": games.len(),
    }))
}

pub async fn game(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> AppResult<Json<Game>> {
    state
        .store
        .get_published(&slug)
        .await
        .map(Json)
        .ok_or_else(|| AppError::NotFound("游戏不存在".into()))
}

pub async fn health(State(state): State<AppState>) -> Json<Value> {
    let games = state.store.games().await;
    let published = games.iter().filter(|game| game.published).count();
    Json(json!({
        "status": "ok",
        "version": env!("CARGO_PKG_VERSION"),
        "games": games.len(),
        "published": published,
    }))
}
