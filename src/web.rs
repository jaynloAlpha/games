use include_dir::{include_dir, Dir, File};

/// 编译期嵌入 `web/`，部署时只需要一个二进制文件。
pub static WEB: Dir<'static> = include_dir!("$CARGO_MANIFEST_DIR/web");

pub fn file(path: &str) -> Option<&'static File<'static>> {
    WEB.get_file(path.trim_start_matches('/'))
}

pub fn text(path: &str) -> Option<&'static str> {
    file(path).and_then(|file| file.contents_utf8())
}

pub fn mime(path: &str) -> &'static str {
    let extension = path.rsplit('.').next().unwrap_or("").to_ascii_lowercase();
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
    fn embeds_web_assets() {
        assert!(file("assets/css/app.css").is_some());
        assert!(text("index.html").is_some());
        assert!(file("assets/fonts/baloo2-latin.woff2").is_some());
    }

    #[test]
    fn mime_types() {
        assert_eq!(mime("assets/css/app.css"), "text/css; charset=utf-8");
        assert_eq!(mime("assets/fonts/x.woff2"), "font/woff2");
        assert_eq!(mime("assets/img/a.png"), "image/png");
        assert_eq!(mime("assets/img/a.svg"), "image/svg+xml");
    }
}
