use axum::{
    extract::{Path, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
};

use crate::models::SiteSettings;
use crate::state::AppState;
use crate::util;
use crate::web;

pub async fn index(State(state): State<AppState>) -> Response {
    let site = state.store.site().await;
    let mut pairs = site_pairs(&site);
    pairs.push((
        "{{PAGE_TITLE}}".to_string(),
        format!(
            "{} · {}",
            util::escape_html(&site.title),
            util::escape_html(&site.tagline)
        ),
    ));
    pairs.push((
        "{{PAGE_DESC}}".to_string(),
        util::escape_html(&site.description),
    ));
    render_or_500("index.html", &pairs)
}

pub async fn play(State(state): State<AppState>, Path(slug): Path<String>) -> Response {
    let site = state.store.site().await;
    let Some(game) = state.store.get_published(&slug).await else {
        return not_found(&site, "这个游戏还没有上架，或者已经搬家了。");
    };

    let mut pairs = site_pairs(&site);
    pairs.push(("{{GAME_TITLE}}".into(), util::escape_html(&game.title)));
    pairs.push(("{{GAME_SUMMARY}}".into(), util::escape_html(&game.summary)));
    pairs.push(("{{GAME_ICON}}".into(), util::escape_html(&game.icon)));
    pairs.push(("{{GAME_ACCENT}}".into(), util::escape_html(&game.accent)));
    pairs.push(("{{GAME_SLUG}}".into(), util::escape_html(&game.slug)));
    pairs.push((
        "{{PAGE_TITLE}}".into(),
        format!(
            "{} · {}",
            util::escape_html(&game.title),
            util::escape_html(&site.title)
        ),
    ));
    pairs.push((
        "{{PAGE_DESC}}".into(),
        util::escape_html(if game.summary.is_empty() {
            &site.description
        } else {
            &game.summary
        }),
    ));
    render_or_500("play.html", &pairs)
}

pub async fn not_found_page(State(state): State<AppState>) -> Response {
    let site = state.store.site().await;
    not_found(&site, "这里没有东西，回首页看看吧。")
}

pub fn not_found(site: &SiteSettings, message: &str) -> Response {
    let mut pairs = site_pairs(site);
    pairs.push(("{{MESSAGE}}".into(), util::escape_html(message)));
    let html = render_page("404.html", &pairs).unwrap_or_else(|| "页面不存在".to_string());
    (
        StatusCode::NOT_FOUND,
        [
            (header::CONTENT_TYPE, "text/html; charset=utf-8"),
            (header::CACHE_CONTROL, "no-store"),
        ],
        html,
    )
        .into_response()
}

fn site_pairs(site: &SiteSettings) -> Vec<(String, String)> {
    vec![
        ("{{SITE_TITLE}}".into(), util::escape_html(&site.title)),
        ("{{SITE_TAGLINE}}".into(), util::escape_html(&site.tagline)),
        ("{{SITE_ACCENT}}".into(), util::escape_html(&site.accent)),
        ("{{YEAR}}".into(), util::current_year().to_string()),
        (
            "{{ASSET_VERSION}}".into(),
            env!("CLAY_ASSET_VERSION").to_string(),
        ),
    ]
}

fn render_or_500(page: &str, pairs: &[(String, String)]) -> Response {
    let Some(html) = render_page(page, pairs) else {
        tracing::error!(page, "内嵌页面缺失");
        return (StatusCode::INTERNAL_SERVER_ERROR, "page missing").into_response();
    };
    (
        [
            (header::CONTENT_TYPE, "text/html; charset=utf-8"),
            (header::CACHE_CONTROL, "no-cache"),
            (header::X_FRAME_OPTIONS, "SAMEORIGIN"),
        ],
        html,
    )
        .into_response()
}

pub fn render_page(page: &str, pairs: &[(String, String)]) -> Option<String> {
    let template = web::text(page)?;
    let mut html = template.to_string();
    for (token, value) in pairs {
        html = html.replace(token.as_str(), value);
    }
    Some(html)
}
