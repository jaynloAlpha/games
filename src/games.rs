use axum::{
    body::Body,
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Redirect, Response},
};
use std::path::PathBuf;

use crate::assets;
use crate::error::{AppError, AppResult};
use crate::state::AppState;
use crate::util;

fn is_hidden(relative: &str) -> bool {
    relative
        .split('/')
        .any(|part| part.starts_with('.') || part.is_empty())
}

pub async fn root_redirect(Path(slug): Path<String>) -> Redirect {
    Redirect::temporary(&format!("/games/{slug}/"))
}

/// 托管游戏自身的静态资源（同源 iframe）。
pub async fn file(
    State(state): State<AppState>,
    Path((slug, path)): Path<(String, String)>,
    headers: HeaderMap,
) -> AppResult<Response> {
    if path.contains('\\') {
        return Err(AppError::NotFound("文件不存在".into()));
    }
    if state.store.get_published(&slug).await.is_none() {
        return Err(AppError::NotFound("游戏不存在".into()));
    }
    let site_root = state.store.game_dir(&slug);
    let relative = if path.is_empty() || path.ends_with('/') {
        format!("{path}index.html")
    } else {
        path
    };
    if is_hidden(relative.trim_end_matches('/')) || relative == "game.json" {
        return Err(AppError::NotFound("文件不存在".into()));
    }

    let joined = util::safe_join(&site_root, &relative)?;
    let canonical_root = tokio::fs::canonicalize(&site_root).await?;
    let canonical = match tokio::fs::canonicalize(&joined).await {
        Ok(path) => path,
        Err(_) => return Err(AppError::NotFound("文件不存在".into())),
    };
    if !canonical.starts_with(&canonical_root) {
        return Err(AppError::NotFound("文件不存在".into()));
    }

    let target: PathBuf = if canonical.is_dir() {
        canonical.join("index.html")
    } else {
        canonical
    };

    let cache = if relative.ends_with(".html") || relative.ends_with(".htm") {
        "no-cache"
    } else {
        "public, max-age=3600"
    };
    assets::serve_game_file(target, &headers, cache).await
}

pub async fn cover(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    headers: HeaderMap,
) -> AppResult<Response> {
    let Some(path) = state.store.cover_path(&slug).await else {
        return Err(AppError::NotFound("没有封面".into()));
    };
    assets::serve_game_file(path, &headers, "public, max-age=604800, immutable").await
}

pub async fn favicon() -> Response {
    (
        StatusCode::PERMANENT_REDIRECT,
        [(header::LOCATION, "/assets/img/favicon.svg")],
        Body::empty(),
    )
        .into_response()
}
