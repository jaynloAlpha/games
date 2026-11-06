use axum::{
    extract::{Request, State},
    http::{header, HeaderValue, StatusCode, Uri},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use serde_json::json;
use tower_http::trace::TraceLayer;

use crate::state::AppState;
use crate::{api, assets, games, pages};

const CSP: &str = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; \
img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'self'; \
media-src 'self' data: blob:; object-src 'none'; base-uri 'self'; form-action 'self'";

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/", get(pages::index))
        .route("/play/{slug}", get(pages::play))
        .route("/games/{slug}", get(games::root_redirect))
        .route("/games/{slug}/{*path}", get(games::file))
        .route("/covers/{slug}", get(games::cover))
        .route("/assets/{*path}", get(assets::embedded))
        .route("/robots.txt", get(assets::robots))
        .route("/favicon.ico", get(games::favicon))
        .route("/healthz", get(api::health))
        .route("/api/site", get(api::site))
        .route("/api/games", get(api::games))
        .route("/api/games/{slug}", get(api::game))
        .fallback(fallback)
        .with_state(state)
        .layer(middleware::from_fn(security_headers))
        .layer(TraceLayer::new_for_http())
}

async fn security_headers(request: Request, next: Next) -> Response {
    let path = request.uri().path().to_string();
    let is_game_asset = path.starts_with("/games/");
    let mut response = next.run(request).await;
    let headers = response.headers_mut();
    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    headers.insert(
        header::REFERRER_POLICY,
        HeaderValue::from_static("strict-origin-when-cross-origin"),
    );
    headers.insert(
        "permissions-policy",
        HeaderValue::from_static("camera=(), microphone=(), geolocation=()"),
    );
    if !is_game_asset {
        headers.insert(
            header::X_FRAME_OPTIONS,
            HeaderValue::from_static("SAMEORIGIN"),
        );
        headers.insert(
            header::CONTENT_SECURITY_POLICY,
            HeaderValue::from_static(CSP),
        );
    }
    response
}

async fn fallback(State(state): State<AppState>, uri: Uri) -> Response {
    if uri.path().starts_with("/api/") {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": { "code": "not_found", "message": "接口不存在" } })),
        )
            .into_response();
    }
    pages::not_found_page(State(state)).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::Request;
    use http_body_util::BodyExt;
    use tower::ServiceExt;

    async fn test_app() -> Router {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.keep();
        let games = root.join("games");
        std::fs::create_dir_all(games.join("demo")).unwrap();
        std::fs::write(
            games.join("demo/game.json"),
            r#"{"title":"演示游戏","summary":"一句话"}"#,
        )
        .unwrap();
        std::fs::write(games.join("demo/index.html"), "<html>demo</html>").unwrap();
        std::fs::write(
            root.join("site.json"),
            r#"{"title":"测试乐园","tagline":"标语","description":"简介"}"#,
        )
        .unwrap();
        let store = crate::store::Store::load(games, root.join("site.json")).await;
        router(AppState { store })
    }

    async fn get(app: &Router, path: &str) -> (StatusCode, String) {
        let response = app
            .clone()
            .oneshot(Request::builder().uri(path).body(Body::empty()).unwrap())
            .await
            .unwrap();
        let status = response.status();
        let bytes = response.into_body().collect().await.unwrap().to_bytes();
        (status, String::from_utf8_lossy(&bytes).to_string())
    }

    #[tokio::test]
    async fn serves_games_api_and_pages() {
        let app = test_app().await;

        let (status, body) = get(&app, "/api/games").await;
        assert_eq!(status, StatusCode::OK);
        assert!(body.contains("demo"));
        assert!(body.contains("演示游戏"));

        let (status, body) = get(&app, "/play/demo").await;
        assert_eq!(status, StatusCode::OK);
        assert!(body.contains("演示游戏"));

        let (status, body) = get(&app, "/games/demo/index.html").await;
        assert_eq!(status, StatusCode::OK);
        assert!(body.contains("demo"));

        let (status, _) = get(&app, "/api/games/missing").await;
        assert_eq!(status, StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn hides_manifest_and_unpublished_games() {
        let app = test_app().await;
        let (status, _) = get(&app, "/games/demo/game.json").await;
        assert_eq!(status, StatusCode::NOT_FOUND);

        let (status, body) = get(&app, "/healthz").await;
        assert_eq!(status, StatusCode::OK);
        assert!(body.contains("\"status\":\"ok\""));
    }

    #[tokio::test]
    async fn unknown_page_returns_html_404() {
        let app = test_app().await;
        let (status, body) = get(&app, "/nope").await;
        assert_eq!(status, StatusCode::NOT_FOUND);
        assert!(body.contains("这个页面去睡觉了"));
    }
}
