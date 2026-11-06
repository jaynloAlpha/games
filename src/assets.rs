use axum::{
    body::Body,
    extract::Path,
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use std::path::{Path as FsPath, PathBuf};
use tokio::io::{AsyncReadExt, AsyncSeekExt};

use crate::error::{AppError, AppResult};
use crate::web;

/// 内嵌的 CSS / JS / 字体 / 图片（URL 前缀 `/assets/`，对应嵌入目录 `web/assets/`）。
pub async fn embedded(Path(path): Path<String>) -> Response {
    let relative = path.trim_start_matches('/');
    if relative.is_empty() {
        return StatusCode::NOT_FOUND.into_response();
    }
    let key = format!("assets/{relative}");
    let Some(file) = web::file(&key) else {
        return StatusCode::NOT_FOUND.into_response();
    };
    let cache = if relative.starts_with("fonts/") {
        "public, max-age=31536000, immutable"
    } else {
        "public, max-age=3600"
    };
    (
        [
            (header::CONTENT_TYPE, web::mime(&key)),
            (header::CACHE_CONTROL, cache),
            (header::X_CONTENT_TYPE_OPTIONS, "nosniff"),
        ],
        file.contents(),
    )
        .into_response()
}

pub async fn robots() -> Response {
    let body = "User-agent: *\nAllow: /\nDisallow: /api/\n";
    (
        [
            (header::CONTENT_TYPE, "text/plain; charset=utf-8"),
            (header::CACHE_CONTROL, "public, max-age=3600"),
        ],
        body,
    )
        .into_response()
}

/// 带 Range 支持的静态文件响应（游戏资源用）。
pub async fn serve_game_file(
    path: PathBuf,
    headers: &HeaderMap,
    cache_control: &str,
) -> AppResult<Response> {
    let metadata = tokio::fs::metadata(&path).await?;
    if !metadata.is_file() {
        return Err(AppError::NotFound("文件不存在".into()));
    }
    let total = metadata.len();
    let mime = mime_for(&path);
    let range = headers
        .get(header::RANGE)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| parse_range(value, total));

    if let Some((start, end)) = range {
        let length = end.saturating_sub(start) + 1;
        let mut file = tokio::fs::File::open(&path).await?;
        file.seek(std::io::SeekFrom::Start(start)).await?;
        let stream = tokio_util::io::ReaderStream::new(file.take(length));
        return Response::builder()
            .status(StatusCode::PARTIAL_CONTENT)
            .header(header::CONTENT_TYPE, mime)
            .header(header::CONTENT_LENGTH, length)
            .header(
                header::CONTENT_RANGE,
                format!("bytes {start}-{end}/{total}"),
            )
            .header(header::ACCEPT_RANGES, "bytes")
            .header(header::CACHE_CONTROL, cache_control)
            .header(header::X_CONTENT_TYPE_OPTIONS, "nosniff")
            .body(Body::from_stream(stream))
            .map_err(|err| AppError::Internal(err.to_string()));
    }

    let file = tokio::fs::File::open(&path).await?;
    let stream = tokio_util::io::ReaderStream::new(file);
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, mime)
        .header(header::CONTENT_LENGTH, total)
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::CACHE_CONTROL, cache_control)
        .header(header::X_CONTENT_TYPE_OPTIONS, "nosniff")
        .body(Body::from_stream(stream))
        .map_err(|err| AppError::Internal(err.to_string()))
}

/// 只接受单段 `bytes=start-end`，够游戏音频/视频拖动用。
pub fn parse_range(value: &str, total: u64) -> Option<(u64, u64)> {
    let spec = value.strip_prefix("bytes=")?;
    if spec.contains(',') || total == 0 {
        return None;
    }
    let (start_text, end_text) = spec.split_once('-')?;
    if start_text.is_empty() {
        let suffix: u64 = end_text.trim().parse().ok()?;
        if suffix == 0 {
            return None;
        }
        let start = total.saturating_sub(suffix);
        return Some((start, total - 1));
    }
    let start: u64 = start_text.trim().parse().ok()?;
    if start >= total {
        return None;
    }
    let end = if end_text.trim().is_empty() {
        total - 1
    } else {
        end_text.trim().parse::<u64>().ok()?.min(total - 1)
    };
    if end < start {
        return None;
    }
    Some((start, end))
}

fn mime_for(path: &FsPath) -> &'static str {
    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    match extension.as_str() {
        "html" | "htm" => "text/html; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "avif" => "image/avif",
        "ico" => "image/x-icon",
        "mp3" => "audio/mpeg",
        "ogg" => "audio/ogg",
        "wav" => "audio/wav",
        "m4a" => "audio/mp4",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "ttf" => "font/ttf",
        "otf" => "font/otf",
        "wasm" => "application/wasm",
        "txt" => "text/plain; charset=utf-8",
        _ => "application/octet-stream",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn range_parsing() {
        assert_eq!(parse_range("bytes=0-99", 1000), Some((0, 99)));
        assert_eq!(parse_range("bytes=500-", 1000), Some((500, 999)));
        assert_eq!(parse_range("bytes=-100", 1000), Some((900, 999)));
        assert_eq!(parse_range("bytes=1000-", 1000), None);
        assert_eq!(parse_range("bytes=0-1,5-6", 1000), None);
        assert_eq!(parse_range("items=0-1", 1000), None);
    }
}

#[cfg(test)]
mod handler_tests {
    use super::*;

    #[tokio::test]
    async fn serves_embedded_css() {
        let response = embedded(Path("css/app.css".to_string())).await;
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn serves_embedded_index() {
        assert!(crate::web::text("index.html").is_some());
    }
}
