use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::error::AppError;

pub fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

pub fn file_mtime_secs(path: &std::path::Path) -> u64 {
    std::fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

/// 当前年份（UTC），避免为了一个页脚年份引入日期库。
pub fn current_year() -> i64 {
    let seconds = now_secs() as i64;
    let days = seconds.div_euclid(86_400);
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let year = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    if month <= 2 {
        year + 1
    } else {
        year
    }
}

pub fn is_valid_slug(slug: &str) -> bool {
    let len = slug.len();
    if !(2..=48).contains(&len) {
        return false;
    }
    if slug.starts_with('-') || slug.ends_with('-') || slug.contains("--") {
        return false;
    }
    slug.chars()
        .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-')
}

/// 校验游戏资源路径：不允许绝对路径、`..`、反斜杠和空段。
pub fn validate_relative_path(path: &str) -> Result<(), AppError> {
    if path.trim().is_empty() {
        return Err(AppError::BadRequest("路径不能为空".into()));
    }
    if path.contains('\\') || path.contains('\0') {
        return Err(AppError::BadRequest("路径包含非法字符".into()));
    }
    let candidate = Path::new(path);
    if candidate.is_absolute() || candidate.has_root() {
        return Err(AppError::BadRequest("不允许绝对路径".into()));
    }
    for component in candidate.components() {
        match component {
            Component::Normal(part) => {
                let part = part.to_string_lossy();
                if part.is_empty() || part == "." || part == ".." {
                    return Err(AppError::BadRequest("路径包含非法片段".into()));
                }
            }
            _ => return Err(AppError::BadRequest("路径包含非法片段".into())),
        }
    }
    Ok(())
}

/// 将相对路径安全地拼接到 base 下。
pub fn safe_join(base: &Path, relative: &str) -> Result<PathBuf, AppError> {
    validate_relative_path(relative)?;
    Ok(base.join(relative))
}

pub fn escape_html(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for ch in input.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            _ => out.push(ch),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slug_validation() {
        assert!(is_valid_slug("abc-123"));
        assert!(!is_valid_slug("a"));
        assert!(!is_valid_slug("Abc"));
        assert!(!is_valid_slug("-abc"));
        assert!(!is_valid_slug("abc--def"));
    }

    #[test]
    fn rejects_traversal() {
        assert!(validate_relative_path("index.html").is_ok());
        assert!(validate_relative_path("assets/img/a.png").is_ok());
        assert!(validate_relative_path("../secret").is_err());
        assert!(validate_relative_path("a/../../b").is_err());
        assert!(validate_relative_path("C:/windows").is_err());
        assert!(validate_relative_path("a\\b").is_err());
    }

    #[test]
    fn escaping() {
        assert_eq!(
            escape_html("<b>\"x\"</b>"),
            "&lt;b&gt;&quot;x&quot;&lt;/b&gt;"
        );
    }

    #[test]
    fn year_is_sane() {
        assert!((2024..=2100).contains(&current_year()));
    }
}
